---
to: <%= name %>/package.json
sh: cd <%= cwd %>/<%= name %> && npm install
---
{
  "name": "<%= name %>",
  "version": "1.0.0",
  "description": "<%= description %>",
  "main": "dist/index.js",
  "scripts": {
    "start": "ts-node index.ts",
    "build": "tsc",
    "fix": "prettier-standard **/*.ts **/*.js",
    "lint": "standard **/*.ts **/*.js"
  },
  "eslintConfig": {
    "parser": "@typescript-eslint/parser",
    "plugins": [
      "@typescript-eslint/eslint-plugin"
    ],
    "rules": {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error"
    }
  },
  "standard": {
    "parser": "@typescript-eslint/parser",
    "plugins": [
      "@typescript-eslint/eslint-plugin"
    ]
  },
  "dependencies": {
    "debug": "^4.1.1",
    "nconf": "^0.10.0"
  },
  "devDependencies": {
<% if(jobs){ -%>
    "@oada/oada-jobs": "github:oada/oada-jobs",
<% } -%>
    "@types/debug": "^4.1.5",
    "@types/node": "^13.5.1",
    "@typescript-eslint/eslint-plugin": "^2.18.0",
    "@typescript-eslint/parser": "^2.18.0",
    "eslint": "^6.8.0",
    "prettier-standard": "^16.1.0",
    "standard": "^14.3.1",
    "ts-node": "^8.6.2",
    "typescript": "^3.7.5"
  }
}
