export
EXE=pacha

all: setup.local build test

.PHONY: clean
clean:
	cargo clean

.PHONY: build
build:
	cargo build

.PHONY: build
bench:
	cargo criterion

.PHONY: release
release:
	cargo build --release

.PHONY: install
install:
	cargo install --debug --path cli --offline

.PHONY: install.release
install.release:
	cargo install --path cli

.PHONY: check
check:
	taplo format --check
	cargo fmt --check -- \
		--config unstable_features=true \
		--config imports_granularity="Module" \
		--config normalize_doc_attributes=true  \
		--config space_after_colon=true 
	deno fmt --check
	mix format --check-formatted

.PHONY: fmt
fmt:
	taplo fmt
	cargo clippy --fix --allow-dirty --allow-staged
	cargo fix --allow-dirty --allow-staged
	cargo fmt -- \
		--config unstable_features=true \
		--config imports_granularity="Module" \
		--config normalize_doc_attributes=true  \
		--config space_after_colon=true 
	deno fmt

.PHONY: setup
setup:
	rustup default stable
	cargo install --force \
		cargo-strip \
		taplo-cli

.PHONY: setup.local
setup.local: setup
	cargo install --force \
		hyperfine \
		cargo-insta \
		mdbook \
		flamegraph \
		miri \
		cargo-asm \
		cargo-criterion

.PHONY: test
test: test.unit test.conc

.PHONY: test.unit
test.unit:
	cargo test

.PHONY: test.conc
test.conc:
	RUSTFLAGS="--cfg shuttle" cargo test conc_ --release

.PHONY: cov
cov:
	cargo llvm-cov --open

.PHONY: doc
doc:
	cargo doc --document-private-items --open
