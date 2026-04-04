# Seed Rules Script

# Inline text for the rules instead of relying on external files
# ... (Add the actual rules here as inline text)

from google.generativeai import embedding  # Ensure the package is installed

# Function to get embedding using Google generativeai package

def _get_embedding(text):
    response = embedding.embed_text(text)
    return response['embeddings']
