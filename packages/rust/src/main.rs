use std::io::Write;

fn main() {
	let arguments: Vec<String> = std::env::args().skip(1).collect();
	let code = chki18n::cli::run(&arguments);

	// Exiting skips the buffers' own flush, so the report is handed over first.
	std::io::stdout().flush().ok();
	std::process::exit(code);
}
