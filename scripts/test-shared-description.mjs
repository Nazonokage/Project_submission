import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/project-description.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { projectDescription, consolidateDescription, missingDocumentationCount } = exports;

const original = { description: 'Current overview', documentation: { abstract: 'Older academic abstract', objectives: 'Build a tracker' } };
const result = consolidateDescription(original);
assert.deepEqual(result, { description: 'Current overview', documentation: { objectives: 'Build a tracker', _legacyAbstracts: ['Older academic abstract'] } });
assert.deepEqual(consolidateDescription(result), result);
assert.equal(original.documentation.abstract, 'Older academic abstract');
assert.deepEqual(consolidateDescription({ description: ' Same ', documentation: { abstract: 'Same' } }), { description: 'Same', documentation: {} });
assert.deepEqual(consolidateDescription({ description: '', documentation: { abstract: ' Legacy only ' } }), { description: 'Legacy only', documentation: {} });
assert.equal(projectDescription({ documentation: [] }), '');
const saved = consolidateDescription(original, 'Edited shared overview', { abstract: 'Stale client copy', objectives: 'New goal', _legacyAbstracts: ['Injected history'] });
assert.equal(saved.description, 'Edited shared overview');
assert.equal('abstract' in saved.documentation, false);
assert.deepEqual(saved.documentation._legacyAbstracts, ['Older academic abstract']);
assert.equal(saved.documentation.objectives, 'New goal');
const templates = [{ fieldKey: 'abstract', required: true }, { fieldKey: 'objectives', required: true }];
assert.equal(missingDocumentationCount(templates, saved), 0);
assert.equal(missingDocumentationCount(templates, { description: 'Shared overview', documentation: {} }), 1);
assert.equal(missingDocumentationCount(templates, { description: '', documentation: {} }), 2);
console.log('PASS shared overview, legacy fallback, conflict preservation, idempotent consolidation, stale client copies, and required field counts');
