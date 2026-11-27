//! Checks that your i18n translation files agree with each other.
//!
//! Point it at a folder of JSON, name the language everything is compared
//! against, and it reports what is missing, what was never translated and what
//! quietly broke.
//!
//! ```no_run
//! use chki18n::{check_translation_files, Options};
//!
//! let result = check_translation_files(
//!     Some("./locales"),
//!     &Options { target: Some("en".into()), ..Options::default() },
//! );
//!
//! assert!(result.success);
//! ```
//!
//! The comparison itself is in [core] and reads no files, so translations held
//! in memory can be checked with [analyze_translations] or one key at a time
//! with [Analyzer::check_entry].

pub mod check;
pub mod cli;
pub mod constants;
pub mod core;
pub mod loader;
pub mod logger;
pub mod options;
pub mod reporter;
pub mod types;

pub use crate::check::{check_translation_files, console_width, load_translations, FileSession};
pub use crate::constants::{CheckCode, FileFormat, GroupBy, KeyCase, Level, Reporter};
pub use crate::core::analyzer::{analyze_translations, create_analyzer, Analyzer};
pub use crate::core::duplicate::{find_duplicate_keys, flatten_translations};
pub use crate::core::session::{create_session, Session};
pub use crate::loader::scan::{scan_translation_directory, ScanResult};
pub use crate::loader::unused_keys::{find_unused_keys, UsageScan};
pub use crate::options::{resolve_options, Options, ResolvedOptions};
pub use crate::reporter::context::ReportInit;
pub use crate::reporter::format_result;
pub use crate::types::{CheckResult, Entry, Input, Issue, KeyUsage, SourceFile, TranslationMap};
