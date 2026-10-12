import numpy as np
import gensim.downloader as api

# -----------------------------
# CONFIG
# -----------------------------

MIN_WORDS = 3
TOP_K = 7
MAX_VOCAB = 50000   # limits memory usage

# -----------------------------
# LOAD WORD VECTORS
# -----------------------------

print("Loading word vectors (this may take a moment)...")
model = api.load("glove-wiki-gigaword-100")  # 100D vectors

# Restrict vocabulary size
vocab = list(model.index_to_key)[:MAX_VOCAB]
word_set = set(vocab)

print(f"Loaded {len(vocab)} words.")


# -----------------------------
# CORE FUNCTIONS
# -----------------------------

def get_user_words():
    raw = input("\nEnter words separated by commas: ")
    words = [w.strip().lower() for w in raw.split(",")]
    words = [w for w in words if w in word_set]
    return words


def average_vector(words):
    vectors = [model[w] for w in words]
    return np.mean(vectors, axis=0)


def cosine_distance(a, b):
    return 1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


def guess_words(user_vector, exclude_words):
    distances = []

    for word in vocab:
        if word in exclude_words:
            continue
        d = cosine_distance(user_vector, model[word])
        distances.append((word, d))

    distances.sort(key=lambda x: x[1])
    return distances[:TOP_K]


def compute_confidence(distances):
    dists = np.array([d for _, d in distances])
    scores = 1 / (dists + 1e-6)
    scores = scores / scores.sum()
    return scores


# -----------------------------
# MAIN LOOP
# -----------------------------

def main():
    words = get_user_words()

    if len(words) < MIN_WORDS:
        print(f"Please enter at least {MIN_WORDS} known words.")
        return

    user_vector = average_vector(words)
    guesses = guess_words(user_vector, words)
    confidences = compute_confidence(guesses)

    print("\nYou may be thinking about:\n")

    for (word, _), conf in zip(guesses, confidences):
        print(f"{word:<15} {conf * 100:.1f}%")

    spread = np.mean([d for _, d in guesses])

    if spread < 0.25:
        level = "high"
    elif spread < 0.4:
        level = "medium"
    else:
        level = "low"

    print(f"\nOverall confidence: {level}")


if __name__ == "__main__":
    main()
