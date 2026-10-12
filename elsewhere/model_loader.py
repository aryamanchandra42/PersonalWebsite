import gensim.downloader as api
import numpy as np
import re
import os
import pickle
from sklearn.metrics.pairwise import cosine_similarity

class ModelLoader:
    _instance = None
    _model = None
    
    # Vocabulary Sets
    _core_vocab_set = None       # The set of ~40k "official" game words
    _core_vocab_list = None      # List of core words
    
    # Vector Data (Full GloVe 400k)
    _all_vectors = None          # Matrix (400000, 100)
    _all_vocab_map = None        # Dict {word: index_in_all_vectors}
    
    # Core Vector Data (Subset for fast computer moves)
    _core_vectors_normalized = None # Matrix (~40000, 100) normalized
    _core_word_to_idx = None     # Dict {word: index_in_core_vectors}

    # Cache file paths
    CACHE_DIR = 'model_cache'
    CORE_VOCAB_FILE = os.path.join(CACHE_DIR, 'core_vocab.pkl')
    ALL_VECTORS_FILE = os.path.join(CACHE_DIR, 'all_vectors.npy')
    ALL_VOCAB_MAP_FILE = os.path.join(CACHE_DIR, 'all_vocab_map.pkl')

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelLoader, cls).__new__(cls)
            cls._instance._load_model()
        return cls._instance

    def _load_model(self):
        """Load Data. Tries cache first, then falls back to Gensim API."""
        if self._core_vocab_set is not None:
            return
        
        try:
            if self._load_from_cache():
                print("Loaded model from cache.")
                return

            print("Loading GloVe model from API (first run)...")
            self._model = api.load('glove-wiki-gigaword-100')
            
            # 1. Build Full Vector Matrix (400k)
            print("Building full vector matrix...")
            all_vocab = list(self._model.index_to_key)
            self._all_vocab_map = {w: i for i, w in enumerate(all_vocab)}
            self._all_vectors = np.vstack([self._model[w] for w in all_vocab])
            
            # 2. Define Core Vocabulary (~40k)
            print("Filtering core vocabulary...")
            self._filter_core_vocabulary(all_vocab)
            
            # 3. Build Core Normalized Matrix (for computer moves & valid checks)
            self._build_core_matrix()
            
            # 4. Save to Cache
            self._save_to_cache()
            
            # Cleanup
            self._model = None
            print("Model loaded and cached.")
            
        except Exception as e:
            print(f"Error loading model: {e}")
            raise

    def _load_from_cache(self):
        if not (os.path.exists(self.CORE_VOCAB_FILE) and 
                os.path.exists(self.ALL_VECTORS_FILE) and 
                os.path.exists(self.ALL_VOCAB_MAP_FILE)):
            return False
            
        try:
            print("Loading from disk...")
            with open(self.CORE_VOCAB_FILE, 'rb') as f:
                self._core_vocab_list = pickle.load(f)
                self._core_vocab_set = set(self._core_vocab_list)
            
            with open(self.ALL_VOCAB_MAP_FILE, 'rb') as f:
                self._all_vocab_map = pickle.load(f)
                
            self._all_vectors = np.load(self.ALL_VECTORS_FILE)
            
            # Rebuild core matrix (fast enough to do in memory)
            self._build_core_matrix()
            return True
        except Exception as e:
            print(f"Cache load failed: {e}")
            return False

    def _save_to_cache(self):
        os.makedirs(self.CACHE_DIR, exist_ok=True)
        with open(self.CORE_VOCAB_FILE, 'wb') as f:
            pickle.dump(self._core_vocab_list, f)
        with open(self.ALL_VOCAB_MAP_FILE, 'wb') as f:
            pickle.dump(self._all_vocab_map, f)
        np.save(self.ALL_VECTORS_FILE, self._all_vectors)

    def _filter_core_vocabulary(self, all_vocab):
        """Define the ~40k subset of 'valid' game words."""
        # Simple heuristic: Top N words, filtered for quality
        MAX_CORE_VOCAB = 50000
        filtered = []
        
        # URL/Technical patterns
        url_patterns = ['http', 'www', '.com', '.org', '.net', '://']
        
        count = 0
        for word in all_vocab:
            if count >= MAX_CORE_VOCAB:
                break
                
            w_lower = word.lower()
            
            # Length constraints
            if len(word) < 2 or len(word) > 20: continue
            
            # Character constraints
            if not re.match(r'^[a-z-]+$', w_lower): continue
            if word != w_lower: continue # Lowercase only
            if '--' in w_lower or w_lower.startswith('-') or w_lower.endswith('-'): continue
            
            # Content constraints
            if any(p in w_lower for p in url_patterns): continue
            
            # Vowel check (avoid obscure acronyms/typos)
            if not any(c in 'aeiou' for c in w_lower): continue
            
            filtered.append(word)
            count += 1
            
        self._core_vocab_list = filtered
        self._core_vocab_set = set(filtered)
        print(f"Core vocabulary size: {len(filtered)}")

    def _build_core_matrix(self):
        """Create normalized matrix for core vocabulary."""
        indices = [self._all_vocab_map[w] for w in self._core_vocab_list]
        matrix = self._all_vectors[indices]
        
        # Normalize
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1
        self._core_vectors_normalized = matrix / norms
        
        self._core_word_to_idx = {w: i for i, w in enumerate(self._core_vocab_list)}

    def is_valid_word(self, word):
        """Check if word is in CORE vocabulary."""
        if self._core_vocab_set is None: return False
        return word in self._core_vocab_set

    def project_word(self, word):
        """
        Option B: If word is in valid GloVe map but NOT in Core Voca,
        find the nearest semantic neighbor in Core Vocab.
        Returns: (projected_word, original_was_valid)
        """
        if self.is_valid_word(word):
            return word, True
            
        if word not in self._all_vocab_map:
            return None, False
            
        # It's an "Unknown" word (in GloVe, not in Core)
        # Find nearest neighbor in Core
        # 1. Get vector of unknown word
        idx = self._all_vocab_map[word]
        vec = self._all_vectors[idx]
        
        # Normalize vec
        norm = np.linalg.norm(vec)
        if norm == 0: return None, False
        vec_norm = vec / norm
        
        # 2. Dot product with all Core vectors
        # (1, 100) @ (100, N) -> (1, N)
        sims = self._core_vectors_normalized @ vec_norm
        
        # 3. Find max
        best_idx = np.argmax(sims)
        best_word = self._core_vocab_list[best_idx]
        
        return best_word, False

    def calculate_distance(self, word1, word2):
        """Get distance between two CORE words."""
        # Ensure they are in core (or have been projected before calling this)
        if not (self.is_valid_word(word1) and self.is_valid_word(word2)):
            return None, None
            
        # Use core matrix for fast calculation
        idx1 = self._core_word_to_idx[word1]
        idx2 = self._core_word_to_idx[word2]
        
        vec1 = self._core_vectors_normalized[idx1]
        vec2 = self._core_vectors_normalized[idx2]
        
        similarity = np.dot(vec1, vec2)
        distance = 1 - similarity
        return float(distance), float(similarity)

    def find_distant_words_batch(self, user_word, num_candidates=100, top_k=10):
        """Computer move logic using Core vocabulary."""
        if not self.is_valid_word(user_word):
            return []
            
        user_idx = self._core_word_to_idx[user_word]
        user_vec = self._core_vectors_normalized[user_idx]
        
        # Sample random candidates from Core
        n_core = len(self._core_vocab_list)
        sample_indices = np.random.choice(n_core, size=min(num_candidates, n_core), replace=False)
        
        # Exclude user word
        sample_indices = sample_indices[sample_indices != user_idx]
        
        candidates = self._core_vectors_normalized[sample_indices]
        sims = candidates @ user_vec
        dists = 1 - sims
        
        # Top K
        best_idxs_local = np.argsort(dists)[-top_k:][::-1]
        
        results = []
        for loc_idx in best_idxs_local:
            real_idx = sample_indices[loc_idx]
            word = self._core_vocab_list[real_idx]
            results.append((word, float(dists[loc_idx]), float(sims[loc_idx])))
            
        return results

    def predict_autocomplete(self, query):
        if not query: return []
        matches = [w for w in self._core_vocab_list if w.startswith(query)]
        return sorted(matches)[:10]

    def search_vocab(self, query):
        return self.predict_autocomplete(query)

