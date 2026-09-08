import os
import glob
import re

directory = '/home/caracas2025/Documentos/mutual/frontend/src/screens'
files = glob.glob(os.path.join(directory, '*.js'))

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'SafeAreaView' in content and 'react-native-safe-area-context' not in content:
        # Remove SafeAreaView from react-native import
        # Handle cases like SafeAreaView, or , SafeAreaView
        content = re.sub(r',\s*SafeAreaView', '', content)
        content = re.sub(r'SafeAreaView\s*,', '', content)
        content = re.sub(r'{\s*SafeAreaView\s*}', '{}', content)
        
        # Add the import from react-native-safe-area-context below the react-native import
        content = re.sub(
            r"(import .*? from 'react-native';)", 
            r"\1\nimport { SafeAreaView } from 'react-native-safe-area-context';", 
            content
        )
        
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed {filepath}")

