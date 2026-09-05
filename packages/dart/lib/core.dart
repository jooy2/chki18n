/// The comparison engine on its own, without the file system.
///
/// Published as `package:chki18n/core.dart` so it can be imported where
/// `dart:io` is not available — a Flutter app on the web, or an editor plugin
/// running in a browser. Everything here is exported from
/// `package:chki18n/chki18n.dart` as well; reach for this entry point when the
/// build must not pull `dart:io` in.
library;

export 'package:chki18n/src/constants.dart'
    show
        Chki18nCheckCode,
        Chki18nCheckMeta,
        Chki18nFileFormat,
        Chki18nGroupBy,
        Chki18nKeyCase,
        Chki18nLevel,
        Chki18nReporter,
        analyzeCheckCodes,
        checkMeta,
        crossKeyCheckCodes,
        defaultExcludeDirs,
        defaultExcludeFiles,
        defaultGroupBy,
        defaultInterpolationPrefix,
        defaultInterpolationSuffix,
        defaultReportWidth,
        defaultReporter,
        defaultTargetLocale,
        maxMeasuredReportWidth,
        reporterByExtension,
        sourceExtensions,
        sourceMaxFileBytes,
        supportedExtensions,
        translationFunctions;
export 'package:chki18n/src/core/analyzer.dart'
    show Chki18nAnalyzer, analyzeTranslations, collectKeys, createAnalyzer, prepareGroups;
export 'package:chki18n/src/core/duplicate.dart'
    show collectFlatKeys, findDuplicateKeys, flattenTranslations, keySeparator;
export 'package:chki18n/src/core/exclude.dart'
    show createFileExcluder, createPathExcluder, matchesNamePattern, pathSegments;
export 'package:chki18n/src/core/interpolation.dart' show extractInterpolationKeys;
export 'package:chki18n/src/core/issue.dart'
    show applyLevelOverrides, createIssue, groupIssuesByCode, hasError, summarizeIssues;
export 'package:chki18n/src/core/key.dart' show checkKeyShape;
export 'package:chki18n/src/core/locale.dart' show isLocaleCode;
export 'package:chki18n/src/core/plural.dart'
    show
        Chki18nPluralCategory,
        Chki18nPluralParts,
        pluralBaseOf,
        pluralCategories,
        pluralCategoriesOf,
        pluralPartsOf,
        usesPluralCategory;
export 'package:chki18n/src/core/result.dart' show buildResult;
export 'package:chki18n/src/core/session.dart' show Chki18nSession, createSession;
export 'package:chki18n/src/core/value.dart'
    show
        extractNumbers,
        extractTags,
        findInvisibleCharacter,
        hasTranslatableText,
        nameOfInvisibleCharacter,
        scriptOfLocale;
export 'package:chki18n/src/core/width.dart' show charWidth, displayWidth;
export 'package:chki18n/src/options.dart'
    show
        Chki18nOptionDefinition,
        Chki18nOptionType,
        Chki18nResolvedResult,
        buildUsageText,
        optionDefinitions,
        optionsFromArgs,
        reporterOfFileName,
        resolveOptions,
        splitOptionList;
export 'package:chki18n/src/types.dart'
    show
        Chki18nEntry,
        Chki18nInput,
        Chki18nIssue,
        Chki18nKeyUsage,
        Chki18nLevelCount,
        Chki18nOptions,
        Chki18nResolvedOptions,
        Chki18nResult,
        Chki18nSourceFile,
        Chki18nSummary,
        Chki18nTextOptions,
        TranslationGroups,
        TranslationMap;
