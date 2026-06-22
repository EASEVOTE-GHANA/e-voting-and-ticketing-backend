import * as fs from 'fs';
import * as path from 'path';

const routesDir = path.join(__dirname, '../src/routes');
const postmanDir = path.join(__dirname, '../.postman');

if (!fs.existsSync(postmanDir)) {
  fs.mkdirSync(postmanDir);
}

const collection = {
  info: {
    name: 'EASEVOTE Backend API',
    description: 'API documentation for EASEVOTE Backend',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: [] as any[]
};

const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.routes.ts'));

for (const file of routeFiles) {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  
  const folderName = file.replace('.routes.ts', '').toUpperCase();
  const folder = {
    name: folderName,
    item: [] as any[]
  };

  const regex = /router\.(get|post|put|patch|delete)\(["']([^"']+)["']/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const endpointPath = match[2];

    const postmanPath = endpointPath.split('/').filter(p => p).map(p => {
      return p.startsWith(':') ? `{{${p.substring(1)}}}` : p;
    });

    const item: any = {
      name: `${method} ${endpointPath}`,
      request: {
        method: method,
        header: [
          {
            key: 'Authorization',
            value: 'Bearer {{token}}',
            type: 'text'
          }
        ],
        url: {
          raw: `{{baseUrl}}/api/v1/${folderName.toLowerCase()}${endpointPath.replace(/:([a-zA-Z0-9_]+)/g, '{{$1}}')}`,
          host: [
            '{{baseUrl}}'
          ],
          path: ['api', 'v1', folderName.toLowerCase(), ...postmanPath]
        }
      },
      response: []
    };

    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      item.request.body = {
        mode: 'raw',
        raw: '{\n    \n}',
        options: {
          raw: {
            language: 'json'
          }
        }
      };
    }

    folder.item.push(item);
  }

  if (folder.item.length > 0) {
    collection.item.push(folder);
  }
}

fs.writeFileSync(path.join(postmanDir, 'easevote_api_collection.json'), JSON.stringify(collection, null, 2));
console.log('Postman collection generated at .postman/easevote_api_collection.json');
