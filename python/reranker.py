from FlagEmbedding import FlagReranker

reranker = FlagReranker('BAAI/bge-reranker-v2-m3', normalize=True) # Setting use_fp16 to True speeds up computation with a slight performance degradation

# Example 1: AI and Machine Learning Query
ai_query = 'What is machine learning?'
ai_passages = [
    'Machine learning is a branch of artificial intelligence that focuses on building systems that learn from data.',
    'Cooking is a form of learning how to prepare food through practice.',
    'Machine learning algorithms can detect patterns in large datasets to make predictions.'
]

# Example 2: Space Exploration Query
space_query = 'What is the International Space Station?'
space_passages = [
    'The ISS is a modular space station in low Earth orbit, used as a multinational collaborative project.',
    'A space station is a type of artificial satellite designed for humans to live and work in space.',
    'The Moon is Earth\'s only natural satellite and has been visited by astronauts.',
    'International cooperation has been crucial in space exploration efforts.'
]

# Example 3: Climate Change Query
climate_query = 'What are the main causes of global warming?'
climate_passages = [
    'Greenhouse gas emissions from human activities are the primary driver of global climate change.',
    'Solar radiation and Earth\'s orbit can influence long-term climate patterns.',
    'Deforestation reduces the planet\'s ability to absorb carbon dioxide.',
    'Natural climate variations have occurred throughout Earth\'s history.'
]

# Sorting and ranking passages by relevance
def rank_passages(query, passages):
    scores = reranker.compute_score([[query, passage] for passage in passages])
    ranked_passages = sorted(zip(scores, passages), key=lambda x: x[0], reverse=True)
    return ranked_passages

# Demonstration of ranking
print(f"\nRanked AI Question:{ai_passages[0]}")
for score, passage in rank_passages(ai_query, ai_passages):
    print(f"Score: {score:.4f}, Passage: {passage}")

print(f"\nRanked Space Question:{space_passages[0]}")
for score, passage in rank_passages(space_query, space_passages):
    print(f"Score: {score:.4f}, Passage: {passage}")

print(f"\nRanked Climate Question:{climate_passages[0]}")
for score, passage in rank_passages(climate_query, climate_passages):
    print(f"Score: {score:.4f}, Passage: {passage}")
