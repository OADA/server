---
to: <%= name %>/tsconfig.json
---
{
  "compilerOptions": {
    "target": "ES2018",
    "esModuleInterop": true,
    "moduleResolution": "node",
    "lib": [
      "ES2018"
    ],
    "sourceMap": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "*": [
        "node_modules/*"
      ]
    }
  },
  "include": [
    "*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
