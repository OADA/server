---
sh: cd <%= cwd %>/<%= name %>
    && git init
    && git add '*' .gitignore
    && git commit --author='hygen <>' -m 'Initial <%= name %> uservice commit'
---
