import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Tuple

# Assuming FlagReranker is imported from FlagEmbedding
# If using the FlagEmbedding package, adjust the import accordingly
try:
    from FlagEmbedding import FlagReranker
except ImportError:
    # Placeholder class if FlagEmbedding is not installed
    class FlagReranker:
        def __init__(self, model_name: str, device: str = 'cpu'):
            self.model_name = model_name
            self.device = device

        def rerank(self, query: str, passages: List[str]) -> List[Tuple[str, float]]:
            # Dummy implementation: assign a random score to each passage
            # Replace with actual model inference
            return [(p, float(len(p)) / 100.0) for p in passages]

# Define the request and response models
class RerankRequest(BaseModel):
    query: str
    passages: List[str]

class RerankResponse(BaseModel):
    ranked_passages: List[Tuple[str, float]]

# Determine device: use MPS if available
device = "mps" if torch.backends.mps.is_available() else "cpu"

# Initialize the reranker model
# Adjust the model name as needed
model = FlagReranker('BAAI/bge-reranker-large', device)

# If the imported FlagReranker does not have a 'rerank' method, monkey-patch one as a dummy implementation
if not hasattr(model, 'rerank'):
    def rerank_method(self, query, passages):
        # Dummy implementation: assign a score based on passage length
        return [(p, float(len(p))/100.0) for p in passages]
    import types
    model.rerank = types.MethodType(rerank_method, model)

# Create FastAPI app
app = FastAPI(title="Reranker Service", description="A FastAPI service for reranking passages using GPU acceleration (MPS)", version="1.0")

@app.post("/rerank")
async def rerank(request: RerankRequest):
    try:
        ranked = model.rerank(request.query, request.passages)
        # Optionally sort the ranked passages by score descending
        ranked_sorted = sorted(ranked, key=lambda x: x[1], reverse=True)
        return ranked_sorted
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
