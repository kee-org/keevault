This lists the major changes in each version of Kee Vault.

Many smaller or partially complete changes will be made on a regular basis. To see all changes, look for the commit history in each of our GitHub repositories.

## 1.1.0

TODO
Fix icon confusion for DriveWindows vs Clock

## 1.0.6

* Show all entries in the Bin, even if they were previously contained within a group that had "Enable searching entries within this group" disabled
* Hide all Bin entries from Kee, even if they were contained within a subgroup before being moved to the Bin

## 1.0.3

* Show password as *s even if XML doesn't request it

## 1.0.2

* Support previous users with a retrial option
* Make it easier to skip the demo before registration
* Update landing page to work with new kee.pm home page and Android app

## 1.0.1

* Removed "beta" labelling

## 1.0.0

* Support importing custom icons from KDBX files

## 0.9.14

* Improved settings synchronisation reliability by comparing the time that you last made a change to the relevant part of your vault
* Reduced memory usage for large vaults

## 0.9.11

* Enable autocomplete of username and tags fields
* When the view is filtered by tag, new entries now inherit that tag by default
* Fields with browser integration enabled are now displayed in the entry history viewer
* The small font size setting now actually reduces the font size
* The password generator is now shown above the field when there is no space below
* Various fixes to drag/drop and clipboard copying of fields
* Improved export kdbx compatibility
* Further code quality improvements to protect against accidentally introducing similar risks to those we fixed in 0.9.10

## 0.9.10

* SECURITY: Addresses the social engineering attack risks identified on 13th May 2020 in KeeWeb

## 0.9.9

* Additional idle lock timeout durations
* Added checkbox to hide/show password in the generator
* Enable downloading attachments on mobile
* Treat Website field links as https if no scheme defined
* Copying URL field now includes the scheme
* Clear master password box after auto-lock timeout
* Save button improvements
* Improved OTP support (7-digit Authy and tolerant of spaces)
* Fixed multi-line fields display in history
* Changing recycle bin setting now correctly represented in the UI
* Various minor layout and style fixes for specific browsers/devices
* Improved password generation entropy
* Improved resilience against local storage failures, browser crashes, etc.
* Improved monospace font on some devices

## 0.9.8

* Ignore invalid characters when importing from non-KeePass sources
* Fix aborted load when opened in new tab by websites that do not isolate themselves from the new tab
* Enable copying messages and clicking website links

## 0.9.7

* Attempting to workaround possible buggy interaction between Chrome ad-blocker and PH link button

## 0.9.6

* Updated content for launch; removed need for registration code
* Enable "press back twice to exit" for Android app
* Update process improved, including removal of potential rare page refresh loop bug

## 0.9.5

* Enhanced import feature for LastPass, 1Password, Dashlane and generic CSV

## 0.9.4

* Account Reset feature
* Fixed bug that prevented addon settings from syncing

## 0.9.3

* Improved registration experience
* Works in Private Browsing mode (although it's not recommended; obviously offline access is still impossible)
* Works in MS Edge browser (albeit much more slowly than in more capable modern browsers)
* No longer risks creating invalid form field DOM IDs and names
* Importing from KeePass is more tolerant of invalid data in the KeePass kdbx file

## 0.9.2

* Remote save errors now rendered as warnings
* Master password changing cross-device reliability improvements
* Offline access improvements
* Enable PWA installation
* Password strength rating improvements
* Bug fix: Tab navigation in details view user/pass
* Faster initial intro page loading

## 0.9.1

* Offline access improvements

## 0.9.0

* Initial release.
