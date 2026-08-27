import math
import re
from typing import List, Dict, Tuple, Optional
from app.rag.knowledge import NHS_CLINICAL_PROTOCOLS


class FastNHSRagEngine:
    def __init__(self):
        self.protocols: List[Dict] = NHS_CLINICAL_PROTOCOLS
        self.vocabulary: Dict[str, int] = {}
        self.protocol_vectors: List[List[float]] = []
        self._build_index()

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r'\w+', text.lower())

    def _build_index(self):
        # Build vocabulary from protocol keywords and topics
        docs = []
        for p in self.protocols:
            content = f"{p['topic']} {' '.join(p['keywords'])} {p['guidance']}"
            docs.append(self._tokenize(content))

        vocab_set = set(word for doc in docs for word in doc)
        self.vocabulary = {word: idx for idx, word in enumerate(vocab_set)}

        # Vectorize knowledge base
        self.protocol_vectors = [self._vectorize(doc) for doc in docs]
        print(
            f"[RAG] Fast Local Vector Engine indexed {len(self.protocols)} NHS clinical protocols.")

    def _vectorize(self, tokens: List[str]) -> List[float]:
        vec = [0.0] * len(self.vocabulary)
        for token in tokens:
            if token in self.vocabulary:
                vec[self.vocabulary[token]] += 1.0
        # Normalize
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    def _cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        return sum(a * b for a, b in zip(v1, v2))

    async def query(self, user_text: str, threshold: float = 0.20) -> Optional[Tuple[Dict, float]]:
        user_tokens = self._tokenize(user_text)
        user_vec = self._vectorize(user_tokens)

        best_score = -1.0
        best_protocol = None

        for idx, proto_vec in enumerate(self.protocol_vectors):
            score = self._cosine_similarity(user_vec, proto_vec)
            if score > best_score:
                best_score = score
                best_protocol = self.protocols[idx]

        if best_score >= threshold and best_protocol:
            return best_protocol, best_score
        return None


rag_engine = FastNHSRagEngine()
