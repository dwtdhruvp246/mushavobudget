// Exercise the patched dependency through the actual CommonJS Xcode consumer.
// All project mutations use Capacitor's template in a disposable directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');

const projectRoot = path.resolve(__dirname, '..');
const projectRequire = createRequire(path.join(projectRoot, 'package.json'));
const cliManifestPath = projectRequire.resolve('@capacitor/cli/package.json');
const cliRequire = createRequire(cliManifestPath);
const xcodePath = cliRequire.resolve('xcode');
const xcodeRequire = createRequire(xcodePath);
const xcode = cliRequire('xcode');
const uuid = xcodeRequire('uuid');
const uuidVersion = xcodeRequire('uuid/package.json').version;
const tar = cliRequire('tar');
const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const methods = [
  ['v3', (buffer, offset) => uuid.v3('stage-0', namespace, buffer, offset)],
  ['v5', (buffer, offset) => uuid.v5('stage-0', namespace, buffer, offset)],
  ['v6', (buffer, offset) => uuid.v6({}, buffer, offset)],
];

for (const [name, invoke] of methods) {
  for (const [length, offset] of [[8, 4], [16, 1], [16, -1]]) {
    const buffer = new Uint8Array(length).fill(0xa5);
    const before = buffer.slice();
    assert.throws(() => invoke(buffer, offset), RangeError, `${name} invalid bounds`);
    assert.deepEqual(buffer, before, `${name} rejects before modifying the buffer`);
  }
  const buffer = new Uint8Array(32).fill(0xa5);
  assert.equal(invoke(buffer, 8), buffer, `${name} supports a valid output buffer`);
  assert.deepEqual(buffer.slice(0, 8), new Uint8Array(8).fill(0xa5));
  assert.deepEqual(buffer.slice(24), new Uint8Array(8).fill(0xa5));
  assert.ok(uuid.validate(uuid.stringify(buffer.slice(8, 24))));
}

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mushavo-xcode-check-'));
try {
  const templateRelativePath = 'App/App.xcodeproj/project.pbxproj';
  tar.x({
    file: path.join(path.dirname(cliManifestPath), 'assets', 'ios-pods-template.tar.gz'),
    cwd: temporaryDirectory,
    sync: true,
    filter: (entryPath) => entryPath === templateRelativePath,
  });
  const templatePath = path.join(temporaryDirectory, templateRelativePath);
  const project = xcode.project(templatePath);
  project.parseSync();
  const generated = new Set();
  for (let index = 0; index < 256; index += 1) {
    const identifier = project.generateUuid();
    assert.match(identifier, /^[0-9A-F]{24}$/);
    assert.ok(!project.allUuids().includes(identifier));
    assert.ok(!generated.has(identifier));
    generated.add(identifier);
  }
  const group = project.addPbxGroup([], 'Stage0Audit', 'Stage0Audit');
  project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
  const source = project.addSourceFile('Stage0Audit.swift', {}, group.uuid);
  assert.ok(source);
  const editedPath = path.join(temporaryDirectory, 'edited.pbxproj');
  fs.writeFileSync(editedPath, project.writeSync());
  const reparsed = xcode.project(editedPath);
  reparsed.parseSync();
  assert.ok(reparsed.pbxGroupByName('Stage0Audit'));
  assert.ok(reparsed.pbxFileReferenceSection()[source.fileRef]);
  assert.ok(reparsed.pbxBuildFileSection()[source.uuid]);
  assert.ok(reparsed.pbxSourcesBuildPhaseObj().files.some((file) => file.value === source.uuid));
  console.log(JSON.stringify({
    status: 'PASS',
    node: process.version,
    capacitor_cli: cliRequire('./package.json').version,
    xcode: xcodeRequire('./package.json').version,
    uuid: uuidVersion,
    commonjs_consumer: 'PASS',
    invalid_buffer_cases: 9,
    valid_buffer_methods: 3,
    generated_project_identifiers: generated.size,
    template_parse_edit_write_reparse: 'PASS',
    native_compile_or_device_test: false,
  }, null, 2));
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
