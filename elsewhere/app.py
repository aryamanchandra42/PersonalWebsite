from flask import Flask, render_template, request, jsonify
from model_loader import ModelLoader

# Use local WordNet for instant dictionary lookups
try:
    import nltk
    try:
        nltk.data.find('corpora/wordnet.zip')
    except LookupError:
        print("Downloading NLTK WordNet data...")
        nltk.download('wordnet')
        
    from nltk.corpus import wordnet
    WORDNET_AVAILABLE = True
except ImportError:
    WORDNET_AVAILABLE = False
    print("Warning: NLTK WordNet not available, falling back to API")

app = Flask(__name__)
loader = ModelLoader()

# In-memory cache for dictionary lookups
_meaning_cache = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search', methods=['GET'])
def search():
    """Autocomplete endpoint"""
    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify([])
    
    results = loader.search_vocab(query)
    return jsonify(results)

@app.route('/api/distance', methods=['POST'])
def calculate_distance():
    """Calculate semantic distance between two words"""
    data = request.json
    word1 = data.get('word1', '').strip().lower()
    word2 = data.get('word2', '').strip().lower()
    
    if not loader.is_valid_word(word1):
        return jsonify({"error": f"'{word1}' not in vocabulary"}), 400
    if not loader.is_valid_word(word2):
        return jsonify({"error": f"'{word2}' not in vocabulary"}), 400
    
    distance, similarity = loader.calculate_distance(word1, word2)
    
    # Calculate absolute best possible move from word1 (from common words)
    # This serves as a benchmark for the user
    best_word, best_distance, _ = loader.find_distant_word(word1, num_candidates=50000)
    
    return jsonify({
        "word1": word1,
        "word2": word2,
        "distance": distance,
        "similarity": similarity,
        "best_move": {
            "word": best_word,
            "distance": best_distance
        }
    })

@app.route('/api/computer-move', methods=['POST'])
def computer_move():
    """Computer finds a word maximally distant from the user's word - optimized with local WordNet"""
    data = request.json
    user_word = data.get('word', '').strip().lower()
    
    if not loader.is_valid_word(user_word):
        return jsonify({"error": "Word not in vocabulary"}), 400
    
    # Get multiple distant candidates at once (vectorized) - more candidates since lookup is now instant
    candidates = loader.find_distant_words_batch(user_word, num_candidates=100, top_k=20)
    
    if not candidates:
        return jsonify({"error": "Could not find distant words"}), 500
    
    # Check meanings for top candidates until we find one (now instant with local WordNet)
    for candidate_word, candidate_distance, candidate_similarity in candidates:
        meaning = get_word_meaning(candidate_word)
        if meaning:
            return jsonify({
                "word": candidate_word,
                "distance": candidate_distance,
                "similarity": candidate_similarity,
                "meaning": meaning
            })
    
    # Fallback: try with even more candidates (still fast with local lookup)
    candidates = loader.find_distant_words_batch(user_word, num_candidates=500, top_k=50)
    for candidate_word, candidate_distance, candidate_similarity in candidates:
        meaning = get_word_meaning(candidate_word)
        if meaning:
            return jsonify({
                "word": candidate_word,
                "distance": candidate_distance,
                "similarity": candidate_similarity,
                "meaning": meaning
            })
    
    return jsonify({"error": "Could not find a word with meaning"}), 500

@app.route('/api/distances-batch', methods=['POST'])
def calculate_distances_batch():
    """Calculate distances for multiple word pairs at once - for graph visualization"""
    data = request.json
    pairs = data.get('pairs', [])
    
    if not pairs or len(pairs) > 100:  # Limit to 100 pairs
        return jsonify({"error": "Invalid pairs list"}), 400
    
    results = []
    for pair in pairs:
        word1 = pair.get('word1', '').strip().lower()
        word2 = pair.get('word2', '').strip().lower()
        
        if loader.is_valid_word(word1) and loader.is_valid_word(word2):
            distance, similarity = loader.calculate_distance(word1, word2)
            results.append({
                "word1": word1,
                "word2": word2,
                "distance": distance,
                "similarity": similarity
            })
        else:
            results.append({
                "word1": word1,
                "word2": word2,
                "distance": None,
                "similarity": None
            })
    
    return jsonify({"results": results})

@app.route('/api/word-meaning', methods=['GET'])
def word_meaning():
    """Get meaning of a word"""
    word = request.args.get('word', '').strip().lower()
    if not word:
        return jsonify({"error": "Word required"}), 400
    
    meaning = get_word_meaning(word)
    return jsonify({"word": word, "meaning": meaning})

def get_word_meaning(word):
    """Get word meaning using local WordNet (instant) with cache"""
    # Check cache first
    if word in _meaning_cache:
        return _meaning_cache[word]
    
    definition = None
    
    if WORDNET_AVAILABLE:
        # Use local WordNet - instant lookup (~1ms)
        synsets = wordnet.synsets(word)
        if synsets:
            definition = synsets[0].definition()
    
    # Cache the result (including None for words without definitions)
    _meaning_cache[word] = definition
    return definition

if __name__ == '__main__':
    app.run(debug=True)
