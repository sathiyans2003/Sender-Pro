const fs = require('fs');
const path = require('path');

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const originalLength = content.length;
            // Replace `._id` with `.id`
            content = content.replace(/\._id/g, '.id');
            // Wait, also `{_id}` or `_id:` if object destructuring?
            content = content.replace(/\{_id/g, '{id');
            content = content.replace(/_id:/g, 'id:');
            content = content.replace(/_id ===/g, 'id ===');
            content = content.replace(/_id !==/g, 'id !==');
            if (content.length !== originalLength || true) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed:', fullPath);
            }
        }
    }
}

walkDir(path.join(__dirname, 'frontend', 'src'));
