## [2.0.1](https://github.com/usekaneo/kaneo/compare/v2.0.0...v2.0.1) (2025-11-02)


### Bug Fixes

* ensure API URL structure is consistent by handling trailing '/api' in base URL ([6a03fa4](https://github.com/usekaneo/kaneo/commit/6a03fa4d78e931a7ef2327348aa238f594a8deec))


### Features

* adds removing of a team member ([ca96157](https://github.com/usekaneo/kaneo/commit/ca9615710dd0de7203fd7112d4502527ce67501a))
* enhance authentication configuration for cross-subdomain support and update API client paths ([343f374](https://github.com/usekaneo/kaneo/commit/343f37462cb078844c55a761cca55092a3a0708b))
* refactor API routing to use separate Hono instance and update client API URL structure ([20bbf00](https://github.com/usekaneo/kaneo/commit/20bbf003036fcd3aa0d8c5521f9e6cf9fbdcc54a))



# [2.0.0](https://github.com/usekaneo/kaneo/compare/v1.2.4...v2.0.0) (2025-10-23)


### Bug Fixes

* preserve formatting when copy/pasting in new task modal ([#432](https://github.com/usekaneo/kaneo/issues/432)) ([#481](https://github.com/usekaneo/kaneo/issues/481)) ([b105d43](https://github.com/usekaneo/kaneo/commit/b105d43d0d90f434c573999c9961fd5ac9b8e8e9))


### Features

* better auth integration ([#466](https://github.com/usekaneo/kaneo/issues/466)) ([91bb9c2](https://github.com/usekaneo/kaneo/commit/91bb9c2a86c25fddb34fff7b589f9684d945b184))
* implement onboarding flow and update routing ([#469](https://github.com/usekaneo/kaneo/issues/469)) ([6f7057b](https://github.com/usekaneo/kaneo/commit/6f7057b13fa8817f1a00b3a05cd008de913ff6b7))



## [2.0.1-beta.2](https://github.com/usekaneo/kaneo/compare/v1.2.4...v2.0.1-beta.2) (2025-10-01)


### Bug Fixes

* adjust button margin in sign-up form for improved layout ([dc8db99](https://github.com/usekaneo/kaneo/commit/dc8db99dd1485bf84c426bfd04f18b3f96eb6e7e))
* merge conflicts, route gen ([4838df3](https://github.com/usekaneo/kaneo/commit/4838df30f5d51e7c9374f277bce9dd1b39f3b1c4))
* preserve formatting when copy/pasting in new task modal ([#432](https://github.com/usekaneo/kaneo/issues/432)) ([#481](https://github.com/usekaneo/kaneo/issues/481)) ([b105d43](https://github.com/usekaneo/kaneo/commit/b105d43d0d90f434c573999c9961fd5ac9b8e8e9))
* update active item styles in navigation components and adjust sign-in callback URL ([c73e8e4](https://github.com/usekaneo/kaneo/commit/c73e8e44c3793727abc4e17128b11166b038af61))
* update email placeholder in sign-in and sign-up forms for consistency ([564f6a6](https://github.com/usekaneo/kaneo/commit/564f6a6bf0a5d5ace9ce8537ae5343e8ce36bac9))


### Features

* add animation classes and keyframes for enhanced UI transitions in CSS ([220cce7](https://github.com/usekaneo/kaneo/commit/220cce723f4c5ec043cd04093b60ec7f8e074dc5))
* add environment configuration and update service definitions for local development ([273a7ce](https://github.com/usekaneo/kaneo/commit/273a7ce02757cc7dd817a5e8e66a17db4deab33e))
* add GitHub sign-in support with environment variable configuration ([0fc8528](https://github.com/usekaneo/kaneo/commit/0fc8528cb762b442042f909733a3e61a68df0718))
* add health check endpoint and update Dockerfile health check command ([aedc019](https://github.com/usekaneo/kaneo/commit/aedc0193ae76d66e6207f421ed19d2a6c40f1dfd))
* add label filtering support to task management, enhancing task visibility and organization ([880572f](https://github.com/usekaneo/kaneo/commit/880572fd1e62366ac01d4fad8e1b2d5b7ad13a21))
* add task management popovers for assignee, due date, priority, and status ([87ae386](https://github.com/usekaneo/kaneo/commit/87ae3866d36be88a4668f81c78af7b2bfdea969e))
* add team and team_member tables, enhance invitation and label tables with new columns, and implement foreign key constraints ([3e174e6](https://github.com/usekaneo/kaneo/commit/3e174e63ba8a6cb2ed31de89fe1f96d8b6e54006))
* add user avatar component and enhance sidebar navigation with workspace switcher ([3b3b9a3](https://github.com/usekaneo/kaneo/commit/3b3b9a3524019a201428d030d6a051a5cbd6932c))
* better auth integration ([#466](https://github.com/usekaneo/kaneo/issues/466)) ([91bb9c2](https://github.com/usekaneo/kaneo/commit/91bb9c2a86c25fddb34fff7b589f9684d945b184))
* enhance email invitation functionality ([cd84548](https://github.com/usekaneo/kaneo/commit/cd84548de2fc68d66eb1356ef331affe762abfb9))
* enhance sidebar navigation with search functionality and UI improvements ([9dacada](https://github.com/usekaneo/kaneo/commit/9dacada90616ce2527011cf984918b0e9cc57bff))
* enhance task labels functionality with deduplication and improved filtering in the board view ([ea8cca3](https://github.com/usekaneo/kaneo/commit/ea8cca302e91fe7153367ff48adb3235cb682b6e))
* enhance task management with activity tracking and updates for assignee, priority, and status ([f37b975](https://github.com/usekaneo/kaneo/commit/f37b975bf2219a22d2199f1d7d59a791590f75e3))
* implement due date update functionality in task management with associated activity tracking ([e177a46](https://github.com/usekaneo/kaneo/commit/e177a4650440ccaa1d7b18697e17027714780849))
* implement magic link authentication and email sending functionality ([90139d7](https://github.com/usekaneo/kaneo/commit/90139d7ce4f88e3113dacea4735d7062b7114fb6))
* implement onboarding flow and update routing ([#469](https://github.com/usekaneo/kaneo/issues/469)) ([6f7057b](https://github.com/usekaneo/kaneo/commit/6f7057b13fa8817f1a00b3a05cd008de913ff6b7))
* implement password hashing and verification using bcrypt in authentication ([17cce57](https://github.com/usekaneo/kaneo/commit/17cce57dbcba0465f447b5b8c927b892c084c36e))
* implement team and label management features in the database schema and API ([6864ec9](https://github.com/usekaneo/kaneo/commit/6864ec9e3e06dedf69e9585d0089975fe228538a))
* initial docs refactor ([cfd92f4](https://github.com/usekaneo/kaneo/commit/cfd92f401b35ed0414242fdf9ba2a9439916af60))
* initial task details page ([43fe59a](https://github.com/usekaneo/kaneo/commit/43fe59ad88bfba18912e0d3979cded8f5b2cb74f))
* integrate rich text editing for task description and title with improved state management ([27d0413](https://github.com/usekaneo/kaneo/commit/27d041337e753c191da10f77080b08ee245e15de))
* migrates web to use auth client organization methods ([5ec4d28](https://github.com/usekaneo/kaneo/commit/5ec4d283b52d1fd8a1eb2645b768898158aee0f6))
* refactor create task modal with new task description editor and enhanced label management ([7649ac0](https://github.com/usekaneo/kaneo/commit/7649ac06e87835e2bbbe84031c0ca274bee96558))
* update dependencies and enhance documentation layout with new features section ([bd6d9b9](https://github.com/usekaneo/kaneo/commit/bd6d9b9b8dffbb7a22079f6530d062fb91445ae3))
* update environment configuration and integrate dotenv-mono for improved variable management ([ffcb482](https://github.com/usekaneo/kaneo/commit/ffcb4821256cef46e34c39ab94c678700175bd1d))



## [1.2.4](https://github.com/usekaneo/kaneo/compare/v1.2.3...v1.2.4) (2025-08-17)


### Bug Fixes

* **#389:** added archived to the calculation of "solved" tickets ([#437](https://github.com/usekaneo/kaneo/issues/437)) ([4e21e6a](https://github.com/usekaneo/kaneo/commit/4e21e6a6740a32044b85c8e7a720d9240d048ee7)), closes [#389](https://github.com/usekaneo/kaneo/issues/389)
* reorder imports in task-activities and task-comment components for consistency ([3267efe](https://github.com/usekaneo/kaneo/commit/3267efe56178413a53497c2f47be745839e4ef62))


### Features

* **#383:** add rich text editor for comments ([#435](https://github.com/usekaneo/kaneo/issues/435)) ([9787e0b](https://github.com/usekaneo/kaneo/commit/9787e0b075f68286fa2e2d81d516f84ee877d084)), closes [#383](https://github.com/usekaneo/kaneo/issues/383)
* **391:** add "archive" and "planned" to the context menu of cards ([#436](https://github.com/usekaneo/kaneo/issues/436)) ([48f4a03](https://github.com/usekaneo/kaneo/commit/48f4a03a3a4b13fa069890100ba3af82958bc92a))
* enhance metadata and sitemap for improved SEO and user experience ([472ff23](https://github.com/usekaneo/kaneo/commit/472ff231656025c0b7bb939c8c01bff0bd2b63be))
* replace loading indicators with a new LoadingSkeleton component for improved UI consistency ([d4c7069](https://github.com/usekaneo/kaneo/commit/d4c7069da5eff244c46fb8fc7b81c144fb0e80ba))



## [1.2.3](https://github.com/usekaneo/kaneo/compare/v1.2.2...v1.2.3) (2025-08-06)



## [1.2.2](https://github.com/usekaneo/kaneo/compare/v1.2.1...v1.2.2) (2025-08-06)


### Bug Fixes

* update default API URL to localhost and add ASCII art logo in main entry file ([0b44b86](https://github.com/usekaneo/kaneo/commit/0b44b86ef067059eb8c73c362e7ee4d7fcbf12dc))


### Features

* implement GitHub issue handling for task status and priority changes ([6d7fe20](https://github.com/usekaneo/kaneo/commit/6d7fe200f3ae1fa73149d36e6a87f179f8e8796d))



## [1.2.1](https://github.com/usekaneo/kaneo/compare/v1.2.0...v1.2.1) (2025-08-05)


### Features

* add delete task confirmation dialog to task card and task info components ([0fa817f](https://github.com/usekaneo/kaneo/commit/0fa817f972407cb4e6669b964dec052950eebbf1))
* enhance task description formatting and skip GitHub issue creation for related tasks ([63cca0a](https://github.com/usekaneo/kaneo/commit/63cca0ac5160724e09065fef95bdd6ad723cde3d))



# [1.2.0](https://github.com/usekaneo/kaneo/compare/v1.1.9...v1.2.0) (2025-08-01)


### Bug Fixes

* resolve delete project dialog bug ([#419](https://github.com/usekaneo/kaneo/issues/419)) ([9d11864](https://github.com/usekaneo/kaneo/commit/9d1186494d725cb585cd35d435800fcb2b628529))



## [1.1.9](https://github.com/usekaneo/kaneo/compare/v1.1.8...v1.1.9) (2025-07-30)



## [1.1.8](https://github.com/usekaneo/kaneo/compare/v1.1.7...v1.1.8) (2025-07-22)


### Features

* add croner for scheduled tasks and implement demo user setup ([cfcfd60](https://github.com/usekaneo/kaneo/commit/cfcfd6034589ee3caa57ea42234260f82d7afa34))



## [1.1.7](https://github.com/usekaneo/kaneo/compare/v1.1.6...v1.1.7) (2025-07-22)


### Features

* enable demo mode in layout and dashboard components ([c6cd1fc](https://github.com/usekaneo/kaneo/commit/c6cd1fc3719276c66693cc0c8457816257299778))



## [1.1.6](https://github.com/usekaneo/kaneo/compare/v1.1.5...v1.1.6) (2025-07-22)



## [1.1.5](https://github.com/usekaneo/kaneo/compare/v1.1.4...v1.1.5) (2025-07-21)


### Bug Fixes

* port number in documentation ([#375](https://github.com/usekaneo/kaneo/issues/375)) ([b1e9814](https://github.com/usekaneo/kaneo/commit/b1e981468667e6ad03276c2172ea23393d40c2c5))



## [1.1.4](https://github.com/usekaneo/kaneo/compare/v1.1.0...v1.1.4) (2025-07-10)


### Bug Fixes

* update task detail modal to display assignee name ([2884c78](https://github.com/usekaneo/kaneo/commit/2884c78c77edfbef23ce01eef8fef8d153208bda))


### Features

* implement GitHub issues import functionality ([ef1bb63](https://github.com/usekaneo/kaneo/commit/ef1bb636dc1876d0d4d2108f732efc98d2568bec))
* implement global search functionality ([f840ec7](https://github.com/usekaneo/kaneo/commit/f840ec79269dbdaed53d1be6755e011e485c040f))
* implement task detail modal and enhance task interaction ([eb3abcc](https://github.com/usekaneo/kaneo/commit/eb3abccdb8a98afcc6be7063e85451e8364cdbf0))



# [1.1.0](https://github.com/usekaneo/kaneo/compare/v1.0.9...v1.1.0) (2025-07-06)


### Bug Fixes

* update task assignee handling and improve task display ([e23f230](https://github.com/usekaneo/kaneo/commit/e23f230891ee7e24fff1e16a67d36a7fda73a585))


### Features

* enhance task retrieval and display with assignee details ([18c5cb2](https://github.com/usekaneo/kaneo/commit/18c5cb28685cb930be93eccb9387208d7ef3969b))



## [1.0.9](https://github.com/usekaneo/kaneo/compare/v1.0.2...v1.0.9) (2025-07-05)


### Bug Fixes

* update Quick Start link in README to point to documentation ([cfed1cc](https://github.com/usekaneo/kaneo/commit/cfed1ccc312081dc6fc405479e091ae0c4ec8d21))


### Features

* add configuration endpoint and integrate config handling in sign-up flow ([700266d](https://github.com/usekaneo/kaneo/commit/700266d237c5787ee6991344380a5afbdd4dd9c7))
* add documentation links to home layout with icons ([6c1a350](https://github.com/usekaneo/kaneo/commit/6c1a350fe3885ce4b1e37a4684f2f0b44cc69166))
* add theme selection options to command palette ([1683937](https://github.com/usekaneo/kaneo/commit/1683937da3329d5cd97e0c6d64054dfde433a798))
* update footer with operational status link and visual indicator ([4018f13](https://github.com/usekaneo/kaneo/commit/4018f13d884d4f4e9c7e5b03f4e552bc522ddad6))
* update layout configuration and metadata ([8bd9407](https://github.com/usekaneo/kaneo/commit/8bd9407d18c5d57285e837636ad88a6ddb34f55f))



## [1.0.2](https://github.com/usekaneo/kaneo/compare/v1.0.1...v1.0.2) (2025-06-22)



## [1.0.1](https://github.com/usekaneo/kaneo/compare/v1.0.0...v1.0.1) (2025-06-22)


### Features

* GitHub integration ([#323](https://github.com/usekaneo/kaneo/issues/323)) ([1457e37](https://github.com/usekaneo/kaneo/commit/1457e37b10cd2c5a3a8b6fda0782172b9e72c035))



# [1.0.0](https://github.com/usekaneo/kaneo/compare/v0.4.0...v1.0.0) (2025-06-20)


### Bug Fixes

* adjust metadata title template for Kaneo documentation ([4e696ab](https://github.com/usekaneo/kaneo/commit/4e696ab7ba233a5a1359de0ae7389a44d37b2c3d))
* simplify metadata default title for Kaneo documentation ([3c24b09](https://github.com/usekaneo/kaneo/commit/3c24b09898e3cbd91198ce831d21baaaf1d32ad1))
* update metadata template for Kaneo project ([020e383](https://github.com/usekaneo/kaneo/commit/020e383918c1881ddb9cb68dfbdcf51fe6621d12))
* update metadata title template for Kaneo documentation ([2fe6196](https://github.com/usekaneo/kaneo/commit/2fe6196545b3c1ecec912e880e9367d95e868767))


### Features

* add manifest and icons for Kaneo project management platform ([fe2d19d](https://github.com/usekaneo/kaneo/commit/fe2d19d937bc4e96aa42b9badc0554e0b4918c59))
* **board:** add CreateTaskModal for task creation functionality ([2bec2d0](https://github.com/usekaneo/kaneo/commit/2bec2d0e92d9f16408f551d08eb87582977ff213))
* comments ui proposal ([#262](https://github.com/usekaneo/kaneo/issues/262)) ([741bbc4](https://github.com/usekaneo/kaneo/commit/741bbc41f617c2cb521e7937c66ab60202713793))
* enhance project settings form with unsaved changes warning ([36854d9](https://github.com/usekaneo/kaneo/commit/36854d926069b48b62f896c48d0dbace849d830c))
* **hero:** update hero component to promote Kaneo Cloud with new icon and link ([23935fb](https://github.com/usekaneo/kaneo/commit/23935fb45b53b03f9e02bb3753677ab1eb96ebed))
* **index.html:** add Plausible Analytics script for cloud.kaneo.app domain ([4edabaf](https://github.com/usekaneo/kaneo/commit/4edabafad7387e8d7ec384548fe10c2af2303ca2))
* migrate from SQLite to PostgreSQL ([#315](https://github.com/usekaneo/kaneo/issues/315)) ([ee540d4](https://github.com/usekaneo/kaneo/commit/ee540d407ce8708874dc6d5694c80eb5e40107b4))
* update documentation with cloud version promotion ([add275c](https://github.com/usekaneo/kaneo/commit/add275cbbd85eeb57186d58f8f7ada2363ea1a61))



# [0.4.0](https://github.com/usekaneo/kaneo/compare/v0.3.0...v0.4.0) (2025-05-10)


### Bug Fixes

* add out directory to ignored files in biome.json ([5607363](https://github.com/usekaneo/kaneo/commit/5607363dc2e015f2ca7ce248964102aa3191532a))
* correct Open Graph image URL to use the proper domain path ([c2f928f](https://github.com/usekaneo/kaneo/commit/c2f928f308116211d06b332cae6cf944d7ac1e46))
* edit project slug max length ([#137](https://github.com/usekaneo/kaneo/issues/137)) ([e8b1c3c](https://github.com/usekaneo/kaneo/commit/e8b1c3cd6071a76d30430564531a2d8461397c7e))
* ensure tables are created only if they do not already exist ([36e6cde](https://github.com/usekaneo/kaneo/commit/36e6cde6128576c9b0caae4c23ab3cb2bcc8bcde))
* fix workspace setting sidebar icon ([#157](https://github.com/usekaneo/kaneo/issues/157)) ([a64f7ba](https://github.com/usekaneo/kaneo/commit/a64f7bad43b208469c5043e9b078ce36667a19b4))
* fixed the saving of the indent of the description of the task ([#219](https://github.com/usekaneo/kaneo/issues/219)) ([201d7ee](https://github.com/usekaneo/kaneo/commit/201d7eefac0203bb221794c481c8921a4ae85756))
* project is highlighted when backlog is active ([#131](https://github.com/usekaneo/kaneo/issues/131)) ([b7daaa3](https://github.com/usekaneo/kaneo/commit/b7daaa37a07a1e88d1d744cd118bd1718db946a6))
* remove title from SVG in Open Graph component and add lint ignore comment ([8db20af](https://github.com/usekaneo/kaneo/commit/8db20af507f909f81135eb964466de5b1d1d67eb))
* remove unnecessary logging of slug in metadata generation ([ad5c814](https://github.com/usekaneo/kaneo/commit/ad5c8147e46a0db785a680dc56b97c2bda874fcc))
* reorder import statements in layout file for consistency ([13c092f](https://github.com/usekaneo/kaneo/commit/13c092f9e9e50e56b0561c5c698afdf711ac6394))
* streamline Open Graph image URL by consolidating domain path ([662ba97](https://github.com/usekaneo/kaneo/commit/662ba97530f9f5887db484331c8ecd694625b3c8))
* update API URL handling in client initialization ([c01daad](https://github.com/usekaneo/kaneo/commit/c01daadfafcd488ed9e7eaf2ad8f52c3360277d2))
* update base path and image URL for Open Graph metadata in documentation ([f4ae3c1](https://github.com/usekaneo/kaneo/commit/f4ae3c1616306ef1b253ee0fc7cdbb89bf1c4d39))
* update environment variable handling and Dockerfile comments ([6222ad6](https://github.com/usekaneo/kaneo/commit/6222ad6080cf768364830814c522c69c207dc0c5))
* update font file paths for Open Graph image generation ([08c13b8](https://github.com/usekaneo/kaneo/commit/08c13b8b383aa56a9adac5ad04dd21931d00ee14))
* update Open Graph image generation and enhance metadata logging ([18c821d](https://github.com/usekaneo/kaneo/commit/18c821dceae414d13bb849578668fd6d9c30e624))
* update Open Graph image URL to include full domain path ([e9498f1](https://github.com/usekaneo/kaneo/commit/e9498f12ea2379e4b51419e2375773e094300889))
* update Open Graph image URL to use the correct GitHub Pages domain ([0645f15](https://github.com/usekaneo/kaneo/commit/0645f15b0aa5fb96412022b18050d0f71f6c9043))
* update port forwarding configuration in documentation and deployment files ([4e01f98](https://github.com/usekaneo/kaneo/commit/4e01f98e1a102b07725f15a05f858270734430d0))
* update registration environment variable and improve error handling ([e5c5b0f](https://github.com/usekaneo/kaneo/commit/e5c5b0f07c97a2e8b4864e3d03cacae163c2796a))
* update site name in Open Graph metadata and enhance layout for image generation ([cdd243c](https://github.com/usekaneo/kaneo/commit/cdd243c58694e7f6f8e8e4bfcd2fcd81bf25dab1))
* update site name in Open Graph metadata and enhance layout for image generation ([bfbad94](https://github.com/usekaneo/kaneo/commit/bfbad94613b74a933a5fce882e8ef3179b1fd4de))


### Features

* add "Edit on GitHub" link to documentation pages ([2acb149](https://github.com/usekaneo/kaneo/commit/2acb14937c617f2cc50f32c669fc11173591df9a))
* add documentation site with Next.js and Fumadocs ([#163](https://github.com/usekaneo/kaneo/issues/163)) ([014c9cf](https://github.com/usekaneo/kaneo/commit/014c9cfa27e25047daa1a0f24fb391ce78dcd457))
* add Icon component for Open Graph image generation and update metadata structure ([75ece2a](https://github.com/usekaneo/kaneo/commit/75ece2a037a472d15b4c9813bb1a0d6e5d6acab8))
* add Inter font files and integrate them into Open Graph image generation ([469dba2](https://github.com/usekaneo/kaneo/commit/469dba2666d90b618d93c3fa975eb4c7580bffa2))
* add issue and pull request templates for better contribution guidelines ([bb47fda](https://github.com/usekaneo/kaneo/commit/bb47fdaf1a6a1dc22f6407ff466020803e1681b4))
* add label management functionality ([6ea9406](https://github.com/usekaneo/kaneo/commit/6ea9406f5577f5a68a90f7d23f22c4b02a8d1555))
* add Plausible analytics script to layout components ([30a066c](https://github.com/usekaneo/kaneo/commit/30a066c90260b97deb0378d1fae81bc8f1b83a8b))
* add registration control feature ([#134](https://github.com/usekaneo/kaneo/issues/134)) ([5b86636](https://github.com/usekaneo/kaneo/commit/5b866368581f6559a10ce951acaad5a7345f02ea))
* add sitemap generation and Open Graph image support ([0ba4fb0](https://github.com/usekaneo/kaneo/commit/0ba4fb09eca1f852375d5882a645366ef69111c6))
* add sorting functionality to task filters ([#217](https://github.com/usekaneo/kaneo/issues/217)) ([3d3d4a8](https://github.com/usekaneo/kaneo/commit/3d3d4a87853e566f2d3c4530e7c2264beb74d40f))
* add task import/export functionality ([f8612a3](https://github.com/usekaneo/kaneo/commit/f8612a3261e2a7a3a6f2613ed5ef939569d8a035))
* delete a task option [#122](https://github.com/usekaneo/kaneo/issues/122) ([#216](https://github.com/usekaneo/kaneo/issues/216)) ([86bacb6](https://github.com/usekaneo/kaneo/commit/86bacb69cffc669eae2b3816fdb809fcee5d4c74))
* disable create project and workspace buttons ([#133](https://github.com/usekaneo/kaneo/issues/133)) ([89e2d66](https://github.com/usekaneo/kaneo/commit/89e2d66165c77fc39500ff8a533431c956cda469))
* enhance CreateTaskModal with improved layout and scrolling ([#183](https://github.com/usekaneo/kaneo/issues/183)) ([452b80b](https://github.com/usekaneo/kaneo/commit/452b80b19c4002d91ebf3c19bec8103c2defc0d0))
* enhance homepage metadata for SEO and social sharing ([622367e](https://github.com/usekaneo/kaneo/commit/622367ec2eb7c3aed6ddbee07be7be923f0b42c4))
* enhance project settings with task data and project icon ([62084a8](https://github.com/usekaneo/kaneo/commit/62084a8d6950006e32178fb7175ae6c81634f2b0))
* implement time tracking feature for tasks ([#172](https://github.com/usekaneo/kaneo/issues/172)) ([2c4e4ca](https://github.com/usekaneo/kaneo/commit/2c4e4ca921cc49f99ed691da98dca076ebc450f5))
* integrate project data fetching in task edit page ([a5d64c2](https://github.com/usekaneo/kaneo/commit/a5d64c27a81b750f8134ad195a97a35ebaef9f58))
* migrate to node.js ([#138](https://github.com/usekaneo/kaneo/issues/138)) ([d099533](https://github.com/usekaneo/kaneo/commit/d099533809a50c8611c5594952706541cf92091d))
* **notification:** implement notification system ([#270](https://github.com/usekaneo/kaneo/issues/270)) ([3907fb2](https://github.com/usekaneo/kaneo/commit/3907fb23042e8654a6e799167098a81873f661ab))
* right click card/row context menu ([#238](https://github.com/usekaneo/kaneo/issues/238)) ([0754ae1](https://github.com/usekaneo/kaneo/commit/0754ae1e77eb2ffab22dc5fd478c1b248090b671))
* set base path for documentation site to "/kaneo" ([88661a0](https://github.com/usekaneo/kaneo/commit/88661a0bfae81b19fd157fc9d5b8871efd04b7de))
* update Hero component link to roadmap and add live roadmap ([c62925f](https://github.com/usekaneo/kaneo/commit/c62925f28ae32b572ae2414dafbfcc6542dcaddb))
* workspace details update and delete feature added ([#119](https://github.com/usekaneo/kaneo/issues/119)) ([44af5ff](https://github.com/usekaneo/kaneo/commit/44af5ff2be063700efbcfb758ba6ca01b2084a77))



# [0.3.0](https://github.com/usekaneo/kaneo/compare/v0.2.0...v0.3.0) (2025-03-26)


### Bug Fixes

* accessibility issues with workspace picker ([78cf89e](https://github.com/usekaneo/kaneo/commit/78cf89ec44054ce2d2ed049c436ad1c3864a5291))
* improves bakclog task row popover styles ([cfd7ea8](https://github.com/usekaneo/kaneo/commit/cfd7ea88f2797511ca6afda3b8e2f0508b99bec7))


### Features

* adds acl's and removing of team members ([43963a0](https://github.com/usekaneo/kaneo/commit/43963a0f70ab10d32606b4adac3d646d3836ba74))
* adds archiving of tasks ([4bfb3eb](https://github.com/usekaneo/kaneo/commit/4bfb3eb5dd8a9228d534ecba9ded5796a8e74357))
* adds backlog ([5fb541c](https://github.com/usekaneo/kaneo/commit/5fb541c81501b08255c227aaacee9694e8160fcd))



# [0.2.0](https://github.com/usekaneo/kaneo/compare/v0.1.0...v0.2.0) (2025-03-24)


### Bug Fixes

* adapting list view on mobile drag ([217ceab](https://github.com/usekaneo/kaneo/commit/217ceabaa2c40ecad76d571fa450d6adfa89ae19))
* adding clear all filters buttons, making responsive ([e5d04dc](https://github.com/usekaneo/kaneo/commit/e5d04dc5f5cfcf5e5ea6b9a41f7e1848bfcdb87b))
* adding loading spinner on task edit page ([d61ffe6](https://github.com/usekaneo/kaneo/commit/d61ffe6d6b7170f01a94e24c4eeacc41800a4c38))
* clear input fields when closing create task dialog ([#115](https://github.com/usekaneo/kaneo/issues/115)) ([731687e](https://github.com/usekaneo/kaneo/commit/731687ecd6b2dee74f8ff1805a39639dd18719b5))
* Clear input fields when closing dialogs ([#89](https://github.com/usekaneo/kaneo/issues/89)) ([1578c0e](https://github.com/usekaneo/kaneo/commit/1578c0ecb6c675c6162f8421ce48d18bd69d9ab0))
* deciding scure of cookie based on request protocol ([3980cdf](https://github.com/usekaneo/kaneo/commit/3980cdf125e5b21c0ab1e3c67bad52084f7f4f25))
* disabling inviting already invited users ([7d13439](https://github.com/usekaneo/kaneo/commit/7d134396c1f2b5d57a0e3fc594ba35fbb65067d5))
* fixing desktop layout for task edition ([07ec9bf](https://github.com/usekaneo/kaneo/commit/07ec9bf183dbcb60b0a3517ea0ed9882f247ae2d))
* fixing desktop styles for task edit ([cb40454](https://github.com/usekaneo/kaneo/commit/cb404545e3a6df3ec86f9b6492f68c4541382c9a))
* force field validation errors ([#109](https://github.com/usekaneo/kaneo/issues/109)) ([654a185](https://github.com/usekaneo/kaneo/commit/654a185c9dbe6f679327c634af016af50e947efa))
* loading tasks initially ([91174ca](https://github.com/usekaneo/kaneo/commit/91174cac3f1a92d0a563926a9bd00b79ce0d902c))
* lowering elysia version to 1.2.15 ([30de754](https://github.com/usekaneo/kaneo/commit/30de7540d940738f12c8fb50cc3debbe4a0410a3))
* making alert have only 12 rem height ([df9a798](https://github.com/usekaneo/kaneo/commit/df9a798c5ccf73d39d9969c8045a398a4b7daf22))
* making board skeletons full width ([77fd7b4](https://github.com/usekaneo/kaneo/commit/77fd7b44cff4df4e261a90c52fd8f8f2c4ce9a85))
* making columns grow as much space as they have ([a8a3540](https://github.com/usekaneo/kaneo/commit/a8a35406d9dcee3b2d44c20637b4778a5fd8768a))
* making demo email unique ([cd42ed2](https://github.com/usekaneo/kaneo/commit/cd42ed2fb0b0e776eec119637cfdcfe45aca2b67))
* making new session for demo user and updating data purge for every hour ([4db1105](https://github.com/usekaneo/kaneo/commit/4db1105681b8fdb6134641456ea60adb87b4402c))
* making tooltip work on mobile ([66ff3f3](https://github.com/usekaneo/kaneo/commit/66ff3f3b3b457bcfe7fc05e00feaf8bb962f5036))
* not returning from middleware ([b71f4c6](https://github.com/usekaneo/kaneo/commit/b71f4c6adb3bfbb2f0d06beee9bdfe14a6510526))
* removing console log ([19bfbc6](https://github.com/usekaneo/kaneo/commit/19bfbc6d31792597b9ef4db61d422445b81dcec7))
* removing fixed height on alert ([cacec48](https://github.com/usekaneo/kaneo/commit/cacec486995634e416c2b8867f13e526c2facacf))
* removing un-setting to workspace and projects when going to settings ([d4b8e5a](https://github.com/usekaneo/kaneo/commit/d4b8e5aa7858958fca15ddc5a24ef7385e099e90))
* renewing sessions on demo mode ([2118510](https://github.com/usekaneo/kaneo/commit/2118510f61f6aa336213387217210ec9e0e530a7))
* returing padding to board ([56d3086](https://github.com/usekaneo/kaneo/commit/56d30860f6ad42acebad16de81099be27eefcc69))
* session expired wasn't getting recreated on demo ([30c0fbb](https://github.com/usekaneo/kaneo/commit/30c0fbbc25fdbf7d4913107098f90a4734efb3ab))
* setting demo sessions to 15m ([d45129c](https://github.com/usekaneo/kaneo/commit/d45129c13c6a190099bfe2ef2cf97fe1a7d21187))
* settings page had workspace selection screen ([6dfa90f](https://github.com/usekaneo/kaneo/commit/6dfa90f483e78906dee087efd44b043b91321504))
* showing empty state for workspaces ([cdf8b11](https://github.com/usekaneo/kaneo/commit/cdf8b119092c77bdd6627ad775ecc291bbcf8e88))


### Features

* add alert for demo page ([#85](https://github.com/usekaneo/kaneo/issues/85)) ([eeca442](https://github.com/usekaneo/kaneo/commit/eeca442f0ef7d9462c83b387ddc20622850ee8aa))
* adding board filters ([8c55b37](https://github.com/usekaneo/kaneo/commit/8c55b37a5ce1d77a926955f18409e92b91e12e93))
* adding demo setup ([#83](https://github.com/usekaneo/kaneo/issues/83)) ([2ff307a](https://github.com/usekaneo/kaneo/commit/2ff307a0b60d6c453dd2806cfb3d42c49f6e2489))
* adding dynamic titles ([6c7d5f2](https://github.com/usekaneo/kaneo/commit/6c7d5f2a09015c190b90714c72a5e669c10d8067))
* adding option to update/remove projects ([8478ab0](https://github.com/usekaneo/kaneo/commit/8478ab06d8daf6487227c7723073129fbf177881))
* adding position of tickets in columns ([93556e7](https://github.com/usekaneo/kaneo/commit/93556e7f71aefe202ee68366004d4b10ab4bcb31))
* adding rich text editor in create task modal ([0f18b94](https://github.com/usekaneo/kaneo/commit/0f18b94f8e6dcecc63ceb6d200c17aa467953782))
* adding seo support ([029a3af](https://github.com/usekaneo/kaneo/commit/029a3afabb660b3b087a8090eccd254caed9f5fa))
* adding toast component ([2bb4f1c](https://github.com/usekaneo/kaneo/commit/2bb4f1cf8f54000030014336a41300a4a84cb359))
* **deployment:** add Helm chart and improve container security ([#116](https://github.com/usekaneo/kaneo/issues/116)) ([139fb51](https://github.com/usekaneo/kaneo/commit/139fb51c5e7e64d5b7bb646f4dfefa5ca954008a)), closes [#80](https://github.com/usekaneo/kaneo/issues/80) [#80](https://github.com/usekaneo/kaneo/issues/80)
* **frontend:** :sparkles: adds cmd+k ([70e0407](https://github.com/usekaneo/kaneo/commit/70e0407c0cc0ad6347e8c6019f7c37904c3224a9))
* improved seo ([15b3747](https://github.com/usekaneo/kaneo/commit/15b37477f5a4e13c02505d6102b1a8a1eb0d387f))
* list view ([5f15ebc](https://github.com/usekaneo/kaneo/commit/5f15ebc1ca8c75d8480beaaa8dfadbdef8548d60))
* making tasks editable ([#97](https://github.com/usekaneo/kaneo/issues/97)) ([67448aa](https://github.com/usekaneo/kaneo/commit/67448aa550e1f14a3f5b80019bab707a11e509bb))
* migrating from rabbit mq to node's event emitter ([1a3fe5f](https://github.com/usekaneo/kaneo/commit/1a3fe5f7c410fd64d263338b772a121c7c0f6158))
* moving from websockets and using polling ([da4dc1a](https://github.com/usekaneo/kaneo/commit/da4dc1a9ab0db3d9094d55af365147a5f9e32b65))
* updating user info popup ([ed75a39](https://github.com/usekaneo/kaneo/commit/ed75a391ac4a4ee6b214f97655e864b218ac5a8a))



# 0.1.0 (2025-02-22)


### Bug Fixes

* :bug: fixing deleted workspaces being cached ([624b206](https://github.com/usekaneo/kaneo/commit/624b20676fedf1b1a5871f916a5c1d5c38a5d2cb))
* :bug: fixing overflowing workspace names ([0c2ab27](https://github.com/usekaneo/kaneo/commit/0c2ab2705d82c86ace8b4919c59d7773b63e989d))
* :bug: fixing route generation for vite ([73ddd6d](https://github.com/usekaneo/kaneo/commit/73ddd6d0138e9223921cbefdd727b2fa61408be0))
* :bug: remove unused import ([fa639e1](https://github.com/usekaneo/kaneo/commit/fa639e15e1c847d4ac89b7925fb2606b6e5900a4))
* :construction_worker: fixing build on pipeline ([767ba10](https://github.com/usekaneo/kaneo/commit/767ba103aca3beeda0a6f0a0df4459ce071f3b74))
* :green_heart: fixing formatting in package.json ([4644f0f](https://github.com/usekaneo/kaneo/commit/4644f0f6e3413591c9dd837a67df7cf8e735718e))
* :sparkles: format drizzle.config.ts ([cccd3ae](https://github.com/usekaneo/kaneo/commit/cccd3aea9420d4815501ec0d15ef1dc08a1f1b15))
* adding cursor button ([3b33c69](https://github.com/usekaneo/kaneo/commit/3b33c69f43c6adb6ad2e11284d20fb294941016b))
* adding dynamic view height on sidebar ([e7f4360](https://github.com/usekaneo/kaneo/commit/e7f4360eaf74b57eb8de48c2709ac4bfd418ee60))
* adding loading state for projects, sync ws when creating new tasks ([3977931](https://github.com/usekaneo/kaneo/commit/3977931ae07de1bcbf3ed1652ffead18b4469b2f))
* changing release branch ([3636788](https://github.com/usekaneo/kaneo/commit/3636788ca23bf418ef098fa2dad4c0da67f09d74))
* fixed but when preloading a workspace / project ([19f3136](https://github.com/usekaneo/kaneo/commit/19f3136e1209203c7dded63c05ee7d6982e668f0))
* fixing build context ([fa736c5](https://github.com/usekaneo/kaneo/commit/fa736c5c60ac75b9a8d9a2f583c49b08d597d1cc))
* fixing empty states ([cdb92fe](https://github.com/usekaneo/kaneo/commit/cdb92fe80858c41f3fdf8009abff87c6df023773))
* fixing local development setup ([894d55d](https://github.com/usekaneo/kaneo/commit/894d55d1c6440b161dd66dd70c7b251db3be3069))
* fixing long task titles ([8927a97](https://github.com/usekaneo/kaneo/commit/8927a971e5b53cbc69bf543efd8bb1d7fd00778e))
* fixing route selection and creating tasks with no asignee ([ae9bc8e](https://github.com/usekaneo/kaneo/commit/ae9bc8eebecc4786e3e7630432e9bc98cf03dd0f))
* improving padding for user info section ([4e904bf](https://github.com/usekaneo/kaneo/commit/4e904bfc8051c49c3468690ae99fbce5706d7fcf))
* improving scrolling on dnd ([17a54fd](https://github.com/usekaneo/kaneo/commit/17a54fdfcbcb9bc43efbe7dd05dd854872930ad9))
* listing web's nginx conf ([9ae5b32](https://github.com/usekaneo/kaneo/commit/9ae5b3209d84529c7edc482f118826502327dfe9))
* major route refactor, adding empty / selection states ([4b448ec](https://github.com/usekaneo/kaneo/commit/4b448ec4f2e365553f62b345032abe713ae14bc3))
* making settings not dependant on a workspaceId ([4a15188](https://github.com/usekaneo/kaneo/commit/4a15188bbdefa3cb8012f42f308bcd5cfae23882))
* making sidebar fixed ([6761a4f](https://github.com/usekaneo/kaneo/commit/6761a4f9930d8f2c77241f2041c4b338750f7665))
* making sidebar on mobile floating ([c3ba0e2](https://github.com/usekaneo/kaneo/commit/c3ba0e244a0d86a7390d97b145e0330b795d8410))
* refactoring publishing flow ([5471b88](https://github.com/usekaneo/kaneo/commit/5471b88ee244064b69853fd0a914cf32803f9f8f))
* removing unused import ([9466dc5](https://github.com/usekaneo/kaneo/commit/9466dc5d18e46d8f30000cf110ed255b53a3045d))
* removing unused packages ([20a8c66](https://github.com/usekaneo/kaneo/commit/20a8c6694d1e1bc345655a4b85a56bf7a981dc48))
* removing unused packages ([49ba8d1](https://github.com/usekaneo/kaneo/commit/49ba8d196d44715dd736ad3de4690a70686f46a3))
* removing unused packages ([de87b29](https://github.com/usekaneo/kaneo/commit/de87b298d00cddf7fff0799bcce7149beb7f2123))
* reseting zustand after sign out ([9352b9f](https://github.com/usekaneo/kaneo/commit/9352b9f77b10fbd37c1ad5557e3368ad27c1fdb1))
* task title was overflowing when too long ([9627cb3](https://github.com/usekaneo/kaneo/commit/9627cb3c25b30e6fb5287a32aebb32bf76ddface))
* updated mutateFn for sign in / up flow ([73f6b68](https://github.com/usekaneo/kaneo/commit/73f6b681fdb084b541bc32738cb397f0b9f6717a))
* updated urls and removing urls ([fd7f1d7](https://github.com/usekaneo/kaneo/commit/fd7f1d765451fd55969fecb5331b61584698d296))
* updating docker context ([0bb17b5](https://github.com/usekaneo/kaneo/commit/0bb17b5d786c3ef110fbd16f08701b139bf39c7f))
* updating reamde ([d6d3ed8](https://github.com/usekaneo/kaneo/commit/d6d3ed8bf8cab3b9a27747c66c4d0ffdf9e2ba13))
* wrong z-index on modals ([2de17b8](https://github.com/usekaneo/kaneo/commit/2de17b8b1993d847a2f22a43891f2254b66ef3a2))


### Features

* :construction_worker: adding workflow to lint project ([382d6c5](https://github.com/usekaneo/kaneo/commit/382d6c5ef0a084d026a7238689f8a357fc05c5fa))
* :construction_worker: updating husky and commitlint ([33e2920](https://github.com/usekaneo/kaneo/commit/33e292027fea1d6dc4546a61b869f180e7d129e0))
* :construction_worker: updating workflow name ([f13d4ef](https://github.com/usekaneo/kaneo/commit/f13d4eff1c021be68b01c7381439d28629b6e22b))
* :fire: adding initial kanban board ([0e2734a](https://github.com/usekaneo/kaneo/commit/0e2734a4757722d753be398c9f7273b7fdfc1274))
* :fire: migrating to sessions, using file routes, adding auth provider ([d6f8ecc](https://github.com/usekaneo/kaneo/commit/d6f8ecce077e3fac67111e7585f81b6bd268d191))
* :sparkles: adding crud for workspaces ([faad3a4](https://github.com/usekaneo/kaneo/commit/faad3a49a327ed3cbee14d96a923997a5daf8bbd))
* :sparkles: adding marketing image ([841eee9](https://github.com/usekaneo/kaneo/commit/841eee9fcf4440370fdd95ee73731d591a6795b4))
* :sparkles: adding marketing image ([91ac6c1](https://github.com/usekaneo/kaneo/commit/91ac6c189ddc81535cf498abcfb8e63a8c32cead))
* :sparkles: adding marketing image ([e0dbd6b](https://github.com/usekaneo/kaneo/commit/e0dbd6bd41a440a0114e5c413d673601153d58a6))
* :sparkles: adding marketing image ([a8568c1](https://github.com/usekaneo/kaneo/commit/a8568c1f6d04685d387996448830b1fb166740e5))
* :sparkles: adding projects ([db2f600](https://github.com/usekaneo/kaneo/commit/db2f600d58ea45bf410f8b91de0577f969b2fbda))
* :sparkles: finishing authentication, adding color modes ([da9c10f](https://github.com/usekaneo/kaneo/commit/da9c10fa56ccf479977d3fad8a547d684067256d))
* :sparkles: finishing socket communication for tasks ([dcb8475](https://github.com/usekaneo/kaneo/commit/dcb84754b3bb970415bb7e16200224bef5271823))
* :sparkles: initial commit for projects ([200d9a6](https://github.com/usekaneo/kaneo/commit/200d9a6df400bab61bbc63f2a28dc3807da77606))
* :sparkles: updating logo design ([b8250e6](https://github.com/usekaneo/kaneo/commit/b8250e68fc3f8013b548750fb87140cb55811ac7))
* adding docker images and compose ([537b47e](https://github.com/usekaneo/kaneo/commit/537b47e328b8b5ee2ef1f0ffb71e78e8e3a42ee8))
* adding empty / error states ([5a0ae89](https://github.com/usekaneo/kaneo/commit/5a0ae89b2f43ee78f955840758bf95cb24fa8ec1))
* adding invites for users ([6f509ea](https://github.com/usekaneo/kaneo/commit/6f509ea85c76de40811282e673caa99ac174df69))
* adding multi platform build ([9e40708](https://github.com/usekaneo/kaneo/commit/9e407089a09f93c0a5ecc8296444f0d3f61f3400))
* adding pending invited users screen ([138dc70](https://github.com/usekaneo/kaneo/commit/138dc7084d9d30bc4a35e2ed94aed90e4c82dccc))
* adding project icons ([500783e](https://github.com/usekaneo/kaneo/commit/500783eb12a2fc64ff7e64d078638a4d4a16a0f2))
* adding project slugs ([e4cd25a](https://github.com/usekaneo/kaneo/commit/e4cd25a6b8c7bf6f6e3928b4dca6684270ed99a5))
* adding sensors for dnd ([3a9f2a9](https://github.com/usekaneo/kaneo/commit/3a9f2a91eaf7cc8c5f330c69cbf702aed0ab0def))
* adding settings page ([dd9ae8f](https://github.com/usekaneo/kaneo/commit/dd9ae8fd74008540c76caed0b7eed398ed408b54))
* changing cover image ([62cb2fb](https://github.com/usekaneo/kaneo/commit/62cb2fb88e9e42de923d68bdd889f87738757905))
* **create-turbo:** apply official-starter transform ([6fcda66](https://github.com/usekaneo/kaneo/commit/6fcda66be3d9e10f32705cd0a59d62eae0e8ef27))
* **create-turbo:** apply package-manager transform ([2aaf064](https://github.com/usekaneo/kaneo/commit/2aaf064f095549ad6600e89954aba9fc2c8385d9))
* **create-turbo:** create basic ([3b8654f](https://github.com/usekaneo/kaneo/commit/3b8654f88adfe575bdd6190af85ce8daeea7f810))
* finishing responsive-ness on manage teams screens ([bf5c55c](https://github.com/usekaneo/kaneo/commit/bf5c55c073f073e6be6fbcb0e3f5cb31a5b0c893))
* initial task edit setup ([2aacb26](https://github.com/usekaneo/kaneo/commit/2aacb262ab519eb1cc5e8c1a4aa3c1bcb9ba595c))
* making manage teams screens responsive ([e78f23c](https://github.com/usekaneo/kaneo/commit/e78f23ce379ceeb3e980095932b300e7ef409755))
* Teams refactor ([#70](https://github.com/usekaneo/kaneo/issues/70)) ([f8403cb](https://github.com/usekaneo/kaneo/commit/f8403cbf8630b9a3a534f6143f8f06896b354118))



# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
