"""
Reranking Microservice using FlagEmbedding

This module provides a FastAPI-based microservice for reranking passages 
based on their relevance to a given query using the FlagEmbedding library.

Key Features:
- Uses BAAI/bge-reranker-large model for high-quality passage reranking
- Supports FP16 acceleration for improved performance
- Normalizes scores for consistent ranking
"""

from fastapi import FastAPI, Query
from pydantic import BaseModel
from typing import List
from FlagEmbedding import FlagReranker

# Sample request for testing and documentation
# curl -X POST http://localhost:8005/rerank \
#      -H "Content-Type: application/json" \
#      -d '{
#          "query": "What are the main causes of climate change?",
#          "passages": [
#              "Greenhouse gas emissions are the primary driver of global warming.",
#              "Solar radiation plays a role in long-term climate patterns.",
#              "Deforestation reduces the planet's carbon absorption capacity."
#          ]
#      }'

app = FastAPI(
    title="Passage Reranking Service",
    description="A microservice for reranking passages based on query relevance",
    version="1.0.0"
)

class RerankRequest(BaseModel):
    """
    Pydantic model for reranking request.
    
    Attributes:
        query (str): The search query or context used for reranking
        passages (List[str]): A list of passages to be reranked
    """
    query: str
    passages: List[str]

class RerankResult(BaseModel):
    """
    Pydantic model for reranking results.
    
    Attributes:
        passage (str): The original passage text
        score (float): Relevance score of the passage to the query
    """
    passage: str
    score: float

# Initialize the reranker with specific configuration
# - Model: BAAI/bge-reranker-large (state-of-the-art reranking model)
# - use_fp16: Enables faster computation with minimal accuracy loss
# - normalize: Ensures scores are on a consistent scale
reranker = FlagReranker('BAAI/bge-reranker-large', use_fp16=True, normalize=True)

@app.post('/rerank', response_model=List[RerankResult], 
          summary="Rerank passages by query relevance",
          description="Reranks a list of passages based on their relevance to the given query")
async def rerank_documents(
    request: RerankRequest, 
    top_k: int = Query(default=50, ge=1, le=100, description="Number of top passages to return (1-100)")
) -> List[RerankResult]:
    """
    Rerank passages based on their relevance to the query.
    
    This function uses the FlagReranker to compute relevance scores for each 
    passage and returns them sorted in descending order of relevance.
    
    Args:
        request (RerankRequest): Contains the query and list of passages to rerank
        top_k (int, optional): Number of top passages to return. Defaults to 25.
    
    Returns:
        List[RerankResult]: Sorted list of passages with their relevance scores
        
    Example:
        Input: 
            query = "What is machine learning?"
            passages = [
                "Machine learning is a branch of AI...",
                "Cooking is a form of learning...",
                "ML algorithms can detect patterns..."
            ]
        Output: 
            [
                {"passage": "Machine learning is a branch of AI...", "score": 0.95},
                {"passage": "ML algorithms can detect patterns...", "score": 0.85},
                {"passage": "Cooking is a form of learning...", "score": 0.15}
            ]
    """
    # Compute scores for each passage using the reranker
    # The compute_score method expects pairs of [query, passage]
    scores = reranker.compute_score([[request.query, passage] for passage in request.passages])
    
    # Sort passages by their relevance scores in descending order
    sorted_results = sorted(
        zip(request.passages, scores),
        key=lambda x: x[1],
        reverse=True
    )
    
    # Convert to RerankResult objects for structured response
    return [RerankResult(passage=passage, score=float(score)) for passage, score in sorted_results[:top_k]]
