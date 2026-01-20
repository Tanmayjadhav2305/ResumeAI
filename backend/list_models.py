#!/usr/bin/env python3
import os
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

api_key = os.environ.get("GOOGLE_API_KEY")
if not api_key:
    print("ERROR: GOOGLE_API_KEY not set")
    exit(1)

print(f"Using API key: {api_key[:20]}...")
genai.configure(api_key=api_key)

print("\n" + "="*60)
print("AVAILABLE MODELS FOR GENERATE_CONTENT")
print("="*60 + "\n")

try:
    models = genai.list_models()
    
    count = 0
    for model in models:
        # Check if model supports generateContent
        if hasattr(model, 'supported_generation_methods'):
            if 'generateContent' in model.supported_generation_methods:
                count += 1
                print(f"\n✅ Model: {model.name}")
                print(f"   Display Name: {model.display_name}")
                print(f"   Supported Methods: {model.supported_generation_methods}")
                if hasattr(model, 'input_token_limit'):
                    print(f"   Input Tokens: {model.input_token_limit}")
                if hasattr(model, 'output_token_limit'):
                    print(f"   Output Tokens: {model.output_token_limit}")
    
    print(f"\n\n{'='*60}")
    print(f"TOTAL MODELS SUPPORTING generateContent: {count}")
    print(f"{'='*60}\n")
    
except Exception as e:
    print(f"ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
