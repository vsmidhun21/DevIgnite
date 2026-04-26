import fs from 'fs';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

// CommonJS interop for babel traverse
const traverse = traverseModule.default || traverseModule;

export class Parser {
  static parseFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf-8');
    
    try {
      const ast = parse(code, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread'
        ]
      });

      const extracted = {
        imports: [],
        exports: [],
        functions: [],
        variables: [],
        usedIdentifiers: new Set(),
      };

      traverse(ast, {
        ImportDeclaration(path) {
          const source = path.node.source.value;
          path.node.specifiers.forEach(spec => {
            extracted.imports.push({
              name: spec.local.name,
              source,
              loc: spec.loc,
              isDefault: spec.type === 'ImportDefaultSpecifier',
              isNamespace: spec.type === 'ImportNamespaceSpecifier'
            });
          });
        },
        ExportDefaultDeclaration(path) {
          let name = 'default';
          if (path.node.declaration.id) {
            name = path.node.declaration.id.name;
          } else if (path.node.declaration.type === 'FunctionDeclaration' && !path.node.declaration.id) {
             name = 'anonymous_default_function';
          }
          extracted.exports.push({ name, isDefault: true, loc: path.node.loc });
        },
        ExportNamedDeclaration(path) {
          if (path.node.declaration) {
            if (path.node.declaration.type === 'VariableDeclaration') {
              path.node.declaration.declarations.forEach(decl => {
                if (decl.id && decl.id.name) {
                  extracted.exports.push({ name: decl.id.name, isDefault: false, loc: decl.loc });
                }
              });
            } else if (path.node.declaration.id) {
              extracted.exports.push({ name: path.node.declaration.id.name, isDefault: false, loc: path.node.declaration.loc });
            }
          }
          path.node.specifiers.forEach(spec => {
            if (spec.exported) {
              extracted.exports.push({ name: spec.exported.name, isDefault: false, loc: spec.loc });
            }
          });
        },
        FunctionDeclaration(path) {
          if (path.node.id) {
            extracted.functions.push({
              name: path.node.id.name,
              loc: path.node.loc,
              code: code.slice(path.node.start, path.node.end)
            });
          }
        },
        VariableDeclarator(path) {
          if (path.node.id && path.node.id.name) {
            // Ignore variables that are just requiring things without destructuring if we wanted, 
            // but let's capture all top-level or inner variables to see if they're used.
            extracted.variables.push({
              name: path.node.id.name,
              loc: path.node.loc,
              code: code.slice(path.parent.start, path.parent.end)
            });
          }
        },
        Identifier(path) {
          // If it's a reference to a variable, not the declaration itself
          if (path.isReferencedIdentifier()) {
            extracted.usedIdentifiers.add(path.node.name);
          }
        },
        JSXIdentifier(path) {
           if (path.parentPath.isJSXOpeningElement() || path.parentPath.isJSXMemberExpression()) {
             // Basic heuristic for JSX tag references
             if (/^[A-Z]/.test(path.node.name)) {
                extracted.usedIdentifiers.add(path.node.name);
             }
           } else if (path.isReferencedIdentifier()) {
             extracted.usedIdentifiers.add(path.node.name);
           }
        }
      });

      return { ast, extracted, code };
    } catch (e) {
      console.warn(`Failed to parse ${filePath}: ${e.message}`);
      return null;
    }
  }
}
