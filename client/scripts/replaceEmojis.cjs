const fs = require('fs');
const path = require('path');

const emojiMap = {
  '🛍️': 'ShoppingBag',
  '🛒': 'ShoppingCart',
  '📷': 'Camera',
  '📦': 'Package',
  '🚚': 'Truck',
  '✅': 'CheckCircle',
  '⚠️': 'AlertTriangle',
  '⚠': 'AlertTriangle',
  '🚨': 'Siren',
  '📹': 'Video',
  '🎥': 'Video',
  '🔒': 'Lock',
  '💳': 'CreditCard',
  '✕': 'X',
  '❌': 'X',
  '💬': 'MessageSquare',
  '✍️': 'PenTool',
  '✍': 'PenTool',
  '★': 'Star',
  '⭐': 'Star',
  '✏️': 'Pencil',
  '✏': 'Pencil',
  '🎉': 'PartyPopper',
  '📄': 'FileText',
  '🔴': 'CircleAlert',
  '🟢': 'CircleCheck',
  '🔙': 'ArrowLeft',
  '📡': 'Radio',
  '📭': 'Mailbox',
  '⏳': 'Hourglass',
  '🛡️': 'Shield',
  '🛡': 'Shield',
  '✉️': 'Mail',
  '🏪': 'Store',
  '📧': 'Mail',
  '📱': 'Smartphone',
  '👕': 'Shirt',
  '📚': 'BookOpen',
  '🏠': 'Home',
  '⚽': 'Dribbble',
  '💄': 'Paintbrush',
  '🍜': 'Soup',
  '🧸': 'ToyBrick',
  '🚗': 'Car',
  '🔍': 'Search',
  '💡': 'Lightbulb',
  '💸': 'Banknote',
  '💰': 'Coins',
  '✓': 'Check',
  '🛍': 'ShoppingBag'
};

const emojiKeys = Object.keys(emojiMap);
const emojiRegex = new RegExp(`(${emojiKeys.join('|')})`, 'g');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function processFile(filePath) {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx')) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let iconsToImport = new Set();
  
  const originalContent = content;

  let newContent = '';
  let inString = false;
  let stringChar = '';
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    // Check if we enter/exit a string or template literal
    if ((char === "'" || char === '"' || char === '`') && content[i-1] !== '\\') {
      // If we are inside JSX block but not in a tag... it's complicated.
      // But let's assume standard quotes.
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (stringChar === char) {
        inString = false;
        stringChar = '';
      }
    }
    
    let matchedEmoji = null;
    for (const emoji of emojiKeys) {
      if (content.startsWith(emoji, i)) {
        matchedEmoji = emoji;
        break;
      }
    }
    
    if (matchedEmoji) {
      if (inString || content.substring(i - 10, i).includes('//')) {
        // Just skip appending it (remove emoji)
      } else {
        // It's outside a string, we assume it's JSX text. Replace with component
        const comp = emojiMap[matchedEmoji];
        iconsToImport.add(comp);
        newContent += `<${comp} className="inline w-5 h-5 mr-1 align-text-bottom" />`;
      }
      i += matchedEmoji.length - 1; // Skip the rest of the emoji chars
    } else {
      newContent += char;
    }
  }

  // Handle iconsToImport
  if (iconsToImport.size > 0) {
    const lucideImportRegex = /import\s+{([^}]+)}\s+from\s+['"]lucide-react['"];/;
    const importMatch = newContent.match(lucideImportRegex);
    
    if (importMatch) {
      const existingImports = importMatch[1].split(',').map(i => i.trim());
      for (const icon of iconsToImport) {
        if (!existingImports.includes(icon)) {
          existingImports.push(icon);
        }
      }
      newContent = newContent.replace(
        lucideImportRegex, 
        `import { ${existingImports.join(', ')} } from 'lucide-react';`
      );
    } else {
      // Insert at the top
      newContent = `import { ${Array.from(iconsToImport).join(', ')} } from 'lucide-react';\n` + newContent;
    }
  }

  if (newContent !== originalContent) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Updated ${filePath}`);
  }
}

walkDir('./src', processFile);
