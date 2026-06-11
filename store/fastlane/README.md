fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios metadata

```sh
[bundle exec] fastlane ios metadata
```

App Store (iPhone + iPad): metadata + screenshots, all 13 languages.

----


## Mac

### mac metadata

```sh
[bundle exec] fastlane mac metadata
```

Mac App Store: metadata + screenshots, all 13 languages.

----


## tv

### tv metadata

```sh
[bundle exec] fastlane tv metadata
```

Apple TV: metadata + screenshots, all 13 languages.

----


## apple

### apple all

```sh
[bundle exec] fastlane apple all
```

All three Apple platforms in sequence.

### apple it_only

```sh
[bundle exec] fastlane apple it_only
```

Upload ONLY Italian screenshots (added after the it name fix), leaving others intact.

----


## Android

### android metadata

```sh
[bundle exec] fastlane android metadata
```

Google Play: listing + screenshots, all 13 languages. dry_run:true validates.

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
