/// The published version of this package.
///
/// Written out rather than read from `pubspec.yaml`, because a compiled
/// executable has no pubspec beside it to read. `test/source_test.dart`
/// asserts the two agree, so a release that bumps one and forgets the other
/// fails before it is published.
library;

/// The version `chki18n --version` prints.
const String packageVersion = '1.1.0';
