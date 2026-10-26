/// Walking a directory tree, the one way both scans walk it.
library;

import 'dart:io';

import 'package:chki18n/src/loader/paths.dart';

/// A file a walk reached: its path, and its path segments relative to the
/// walk's root with the file name last.
typedef Chki18nWalkedFile = ({String path, List<String> segments});

/// Every wanted file below [root], depth first and in name order.
///
/// A directory lists its entries in whatever order the file system keeps, so
/// sorting is what makes two walks of one tree, on two machines or in two
/// packages, meet its files in the same order. Hidden entries are tooling state
/// and are never entered, and a link to a directory is not followed: one that
/// points back up the tree would never end.
///
/// [isExcludedDirectory] is asked about each directory by its segments,
/// [isWanted] about each file, and [onUnreadable] is told about a directory
/// that could not be listed, the root included.
Stream<Chki18nWalkedFile> walkFiles(
  String root, {
  required bool Function(List<String> segments) isExcludedDirectory,
  required bool Function(Chki18nWalkedFile file) isWanted,
  void Function(String directory)? onUnreadable,
}) {
  Stream<Chki18nWalkedFile> walk(String directory, List<String> segments) async* {
    List<FileSystemEntity> entries;

    try {
      entries = await Directory(directory).list(followLinks: false).toList();
    } on FileSystemException {
      onUnreadable?.call(directory);
      return;
    }

    entries.sort((a, b) => basenameOf(a.path).compareTo(basenameOf(b.path)));

    for (final entry in entries) {
      final name = basenameOf(entry.path);

      if (name.startsWith('.')) {
        continue;
      }

      final path = joinPath(directory, name);
      final entrySegments = [...segments, name];

      if (entry is Directory) {
        if (!isExcludedDirectory(entrySegments)) {
          yield* walk(path, entrySegments);
        }

        continue;
      }

      final file = (path: path, segments: entrySegments);

      if (isWanted(file)) {
        yield file;
      }
    }
  }

  return walk(root, const []);
}
