# OnlyMap Commercial License Agreement

**Last Updated:** July 14, 2026

This OnlyMap Commercial License Agreement ("Agreement") governs access to and use of OnlyMap, published as the `OnlyMap` package or otherwise made available by the copyright holder ("Licensor"). By downloading, installing, accessing, or using the Software, you accept this Agreement.

If you are accepting this Agreement on behalf of a company or other legal entity, you represent that you have authority to bind that entity. In that case, "Licensee" and "you" refer to that entity.

## 1. Definitions

"Software" means OnlyMap, including its compiled code, package files, documentation, examples, type definitions, updates, and other materials provided by Licensor under this Agreement.

"Application" means a website, application, service, internal tool, or other product created by Licensee that incorporates the Software and adds substantial functionality beyond the Software itself.

"Authorized Users" means Licensee's employees and contractors who need to access the Software solely for Licensee's benefit.

"Order Form" means an invoice, checkout receipt, subscription record, purchase order accepted by Licensor, or other written agreement that identifies Licensee's paid license, license scope, term, fees, support terms, or other commercial terms.

## 2. License Grant

Subject to Licensee's compliance with this Agreement and any applicable Order Form, Licensor grants Licensee a limited, non-exclusive, non-transferable, non-sublicensable, revocable license during the applicable license term to:

1. install and use the Software for Licensee's internal development, testing, staging, CI/CD, and production build workflows;
2. use the Software to develop, operate, and maintain Applications;
3. make backup, archival, and build-cache copies reasonably necessary for permitted use; and
4. distribute the Software only as an inseparable, bundled, compiled, or minified part of an Application, solely to the extent necessary for end users to use that Application.

No ownership rights are transferred. Licensor and its licensors retain all right, title, and interest in and to the Software.

## 3. Non-Commercial and Commercial Use

The Software is commercial proprietary software.

**Non-Commercial Use.** Licensee may exercise the rights granted in Section 2 free of charge for Non-Commercial Use, provided that the Software's included attribution — the on-map "OnlyMap by NIKA" notice and other proprietary notices — remains visible, unmodified, and unobstructed in every Application. "Non-Commercial Use" means personal, educational, academic-research, or evaluation use that is not intended for or directed toward commercial advantage or monetary compensation, whether for Licensee or any third party. Use by or on behalf of a for-profit business (including internal business tools), in any product or service that generates revenue (including through advertising, subscriptions, or paid access), or in paid consulting or government work is not Non-Commercial Use. Non-Commercial Use may be subject to technical limits built into the Software.

**Commercial use.** Any use other than Non-Commercial Use requires a purchased and maintained valid commercial license from Licensor, unless Licensor has granted Licensee a separate written license.

Access to an npm package, repository, package tarball, source archive, or build artifact does not by itself grant any rights beyond the rights expressly granted in this Agreement.

If an Order Form states usage limits, seat limits, application limits, domain limits, revenue limits, territory limits, term dates, or other license scope terms, Licensee must comply with those terms. If there is a conflict between this Agreement and an Order Form, the Order Form controls only for that conflict.

## 4. npm and Package Access

Licensee may not share npm access tokens, registry credentials, private package access, license keys, or other access mechanisms with anyone other than Authorized Users.

Licensee may not mirror, republish, proxy, cache, or make the Software available through another package registry, CDN, repository, file server, or artifact store except for internal systems used solely by Authorized Users for permitted development, build, deployment, or archival purposes.

## 5. Restrictions

Except as expressly permitted by this Agreement, Licensee may not:

1. copy, modify, adapt, translate, fork, or create derivative works of the Software;
2. reverse engineer, decompile, disassemble, or otherwise attempt to derive source code, underlying ideas, algorithms, or non-public interfaces of the Software, except to the limited extent applicable law prohibits this restriction;
3. redistribute, sublicense, sell, rent, lease, lend, publish, upload, host, make available, or otherwise transfer the Software as a standalone library, SDK, package, component, service, or development tool;
4. use the Software to create or offer a product or service that competes with the Software as a map library, visualization SDK, declarative mapping framework, or developer tool;
5. remove, obscure, or alter proprietary notices, license notices, copyright notices, or attribution included with the Software;
6. use the Software in violation of applicable law or third-party rights;
7. bypass license controls, technical protection measures, usage limits, access controls, or package access restrictions; or
8. permit any third party to do anything prohibited by this Agreement.

Licensee is responsible for all use of the Software by its Authorized Users and anyone who accesses the Software through Licensee.

## 6. Application Distribution

Licensee may distribute Applications to its end users, customers, or internal users only if:

1. the Application does not expose the Software as a standalone library, SDK, package, API, mapping framework, or developer tool;
2. end users cannot reasonably extract and use the Software independently from the Application;
3. Licensee does not grant end users any rights to modify, redistribute, sublicense, or reverse engineer the Software;
4. Licensee's distribution complies with any Order Form limits; and
5. Licensee remains responsible for all Software copies included in the Application.

This section permits ordinary browser delivery of bundled JavaScript that contains the Software as part of an Application. It does not permit publishing the Software itself to another registry, CDN, repository, or download site.

## 7. Source Code

Licensor is not required to provide source code. If Licensor provides source code, readable JavaScript, TypeScript declarations, examples, or other human-readable materials, those materials are licensed only for the limited use expressly permitted by this Agreement and do not grant any open source, modification, redistribution, or sublicensing rights.

## 8. Third-Party Software

The Software may include, depend on, interoperate with, or reference third-party software, open source packages, map data, map tiles, fonts, models, services, or other materials. Those third-party materials are governed by their own terms, and this Agreement does not limit any rights Licensee may have under applicable third-party licenses.

Licensee is responsible for obtaining and complying with all third-party licenses, API keys, service terms, map data rights, attribution requirements, and usage limits required for Licensee's Applications.

## 9. Feedback

If Licensee provides suggestions, bug reports, feature requests, or other feedback, Licensee grants Licensor a perpetual, irrevocable, worldwide, royalty-free license to use that feedback without restriction or obligation.

## 10. Updates and Support

Licensor may provide updates, patches, or new versions at its discretion. Unless an Order Form states otherwise, Licensor has no obligation to provide maintenance, support, uptime, compatibility commitments, or updates.

Updates are part of the Software and are governed by this Agreement unless Licensor provides different terms with the update.

## 11. Telemetry

The Software may transmit anonymous, deployment-scoped usage reports and error reports to Licensor's telemetry endpoint when the Software runs (for example, when a map finishes loading). These reports may include the Software version, feature and layer usage counts, widget types, the hostname of the page using the Software, an optional author-assigned map identifier, and, for errors caused by the Software, sanitized error signatures.

Telemetry reports do not include end-user identifiers, page URLs or paths, cookies, map data, or the contents of Licensee's Applications, and Licensor does not store IP addresses from telemetry requests. Telemetry can be disabled at any time, globally via `OmMap.configureTelemetry({ disabled: true })` or per map with the `telemetry="off"` attribute. The full payload schema and collection rules are documented in the Software's `docs/telemetry.md`.

## 12. Fees and Taxes

Licensee must pay all fees stated in the applicable Order Form. Fees are non-refundable except as expressly stated in the Order Form or required by law.

Licensee is responsible for taxes, duties, levies, and similar governmental charges arising from its purchase or use of the Software, excluding taxes based on Licensor's net income.

## 13. Term and Termination

This Agreement begins when Licensee first downloads, installs, accesses, or uses the Software and continues until terminated.

Licensor may terminate this Agreement immediately if Licensee breaches this Agreement or an Order Form. Upon termination or expiration, Licensee must stop using the Software and destroy or delete all copies in its possession or control, except that Licensee may retain archival copies required by law or ordinary backup systems if those copies are not used.

Sections that by their nature should survive termination will survive, including ownership, restrictions, payment obligations, warranty disclaimers, liability limits, and governing law.

## 14. Disclaimer of Warranty

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, AVAILABILITY, SECURITY, OR ERROR-FREE OPERATION.

## 15. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LICENSOR WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST REVENUE, LOST DATA, BUSINESS INTERRUPTION, OR PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES, ARISING OUT OF OR RELATING TO THE SOFTWARE OR THIS AGREEMENT, EVEN IF LICENSOR HAS BEEN ADVISED OF THE POSSIBILITY OF THOSE DAMAGES.

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LICENSOR'S TOTAL LIABILITY ARISING OUT OF OR RELATING TO THE SOFTWARE OR THIS AGREEMENT WILL NOT EXCEED THE AMOUNTS PAID BY LICENSEE TO LICENSOR FOR THE SOFTWARE DURING THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO LIABILITY, OR USD 100 IF LICENSEE PAID NO AMOUNTS DURING THAT PERIOD.

## 16. Export and Compliance

Licensee must comply with all applicable export control, sanctions, anti-corruption, privacy, data protection, and other laws applicable to Licensee's use of the Software.

## 17. Assignment

Licensee may not assign or transfer this Agreement, any Order Form, or any rights or obligations under them without Licensor's prior written consent. Any attempted assignment in violation of this section is void.

## 18. Governing Law

This Agreement is governed by the laws of the jurisdiction in which Licensor resides or is organized, without regard to conflict of law principles. The parties consent to the exclusive jurisdiction and venue of the courts located in that jurisdiction for disputes arising out of or relating to this Agreement.

## 19. Entire Agreement

This Agreement, together with any applicable Order Form, is the entire agreement between Licensor and Licensee regarding the Software and supersedes all prior or contemporaneous agreements, proposals, or understandings about the Software.

## 20. Contact

For licensing questions or requests for permissions beyond this Agreement, contact Licensor through the official repository, npm package page, website, or other distribution channel for the Software.
