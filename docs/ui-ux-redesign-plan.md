# Shellfie UI and UX redesign

## Design direction

Design a Philippine crab atlas for students exploring species and a teacher watching the team present its work. The first screen opens the field guide. By the end of the demo, someone in the audience should be able to name one feature they examined and explain why the app offered a possible match.

On the classroom display, compose the opening like a spread in a natural-history book. Set “Crabs of the Philippines” and a name-search field on the left. Give one credited whole-specimen photograph the larger right column, with its common name, scientific name and a link to open the entry. Let the other species continue directly below as a photographic index. Keep **Identify a photo** visible in the header. On a phone, put search and the species index first, and offer camera and library immediately on the Identify screen.

Build on the existing warm paper background, mangrove green, serif headings and DM Sans controls. Reserve deep green for primary actions and dark ink for reading. Use shell orange sparingly for illustration details. Pair status words with distinct icons. Keep photo credits legible and let the full shell, legs and claws fit within the comparison frame. Use the existing crab illustration for practical capture guidance where it earns its space.

## What the current interface tells us

| Current behavior | Consequence for the redesign |
| --- | --- |
| At the mobile breakpoint, a 190 px specimen illustration precedes a 265 px drop zone. The camera button follows both. | Once a student opens Identify, put the camera and library controls within reach. Keep desktop drag-and-drop. |
| An experimental result can say “Confident identification.” History uses the first candidate's name as its headline even when the result is uncertain. | Lead with the same result language everywhere. Score details are secondary to what the observer can do next. |
| Selecting a candidate opens a guide entry. Its Back action clears the selected species and returns to the catalog. | Remember where the reader came from. Back from a comparison should restore the observation and selected comparison. |
| During startup the model initially appears unavailable. History initially appears empty. An unavailable observation photo silently disappears. | Give loading, empty, expired and failed states distinct messages. Show a retry for recoverable failures. |

Implementation references include [the capture, result and navigation flow](../frontend/App.tsx), [mobile layout rules](../frontend/readability.css), [photo attribution](../frontend/SpeciesPhoto.tsx) and [classifier output](../backend/classifier.py).

## The experience to prototype

Start in the searchable guide. Open a species entry, inspect the whole specimen, then choose **Try this example photo** to carry its credited image into Identify. Submit it through the same upload and prediction flow as a student photo. In the comparison view, label that input **Example photo**. For a student upload, use **Your photo**. Keep the example's catalog identity separate from the model's live suggestion so the class can discuss agreement or disagreement.

1. **Capture.** Offer camera and library immediately. After selection, show the full preview, Change photo and Identify crab. Give one useful framing tip near the camera action. Put file-specific errors beside the preview. Announce upload and analysis separately using the actual request stages. If analysis fails after upload, reuse the valid upload on retry.
2. **Understand the result.** Use **Possible match** for an accepted experimental suggestion and **Match uncertain** when the model abstains. A blurry image gets a concrete retake prompt. A close ranking gets **Compare possible matches**. If the model is unavailable, give a direct route to the field guide. Describe the active model's coverage beside the result. The current catalog has 12 entries and the model compares eight species. Keep the short food-safety message visible. Put technical scores and their interpretation behind a details control.
3. **Compare.** Keep **Your photo** and **Reference photo** visibly labeled. On desktop use adjacent images. On a phone offer labeled toggles for the same bounded image area, with a selected state and an accessible alternative to gestures. Let the observer switch candidates without losing their photo. Show a distinguishing feature only where reviewed source material supports it. Where notes are pending, offer the credited reference photo and say that the trait notes await review.
4. **Explore the guide.** Give every entry a stable URL. Lead with a full specimen photo, common name, scientific name, and available identifying traits. Follow with habitat, lookalikes, safety information and sources. Preserve search and scroll position on return. With 12 entries, name search and a scannable photo index are enough for the first release.
5. **Revisit an observation.** Keep the result wording consistent with the original assessment. Show the observation date and a thumbnail while available. After 24 hours, label the photo as expired and keep the result readable during its 30-day retention period. Confirm deletion by naming the observation and explaining that its photo and result will be removed.

Use Field guide, Identify and My observations as the three public destinations, in that order. Test a labeled bottom bar on mobile and header links on desktop. Keep reviewer access in the footer. In a later pass, improve the two review queues with clearer item context, rationale validation and feedback on each decision.

## Suggested three-minute classroom walkthrough

1. **Show the specimen.** Open the blue swimming crab entry. Point out its common and scientific names, enlarge its credited photo, and ask the class which visible feature they would compare.
2. **Run the example live.** Use that photo with the experimental classifier. The guide currently contains 12 entries and the model compares eight species. In the local trial this photo returned an uncertain result, with the three-spot swimming crab ranked first. Rehearse with the installed model and present the result it actually returns.
3. **Compare and explain.** Put the input beside the suggested species photo and invite the class to compare the same part of each animal. Finish by reopening the saved observation so the teacher can see how the app records uncertainty. Rehearse on the presentation laptop using the bundled photographs and check labels from a back-row seat.

## Delivery order and evidence of success

| Milestone | Deliverable | Proposed acceptance check |
| --- | --- | --- |
| 1 · Prove the classroom journey | Clickable desktop and phone prototype covering atlas, species entry, example selection and comparison | Ask five classmates to find the blue swimming crab and interpret an uncertain result. Aim for four to finish unaided. Check that a back-row viewer can read the species names and result status. |
| 2 · Build the live demo | One complete React flow using the existing catalog, upload and prediction APIs. Give observations and species their own navigation entries. | Start at the atlas, submit a bundled example, compare candidates and return to the observation. Repeat with a personal file, a failed upload, a phone and keyboard-only navigation. |
| 3 · Finish guide and history | Searchable index, species pages, retention states and deletion confirmation. Reuse the result presentation in history. | Refresh a species URL, restore a search using Back, reopen an uncertain observation after its photo expires, and cancel a deletion. |
| 4 · Polish and release | Responsive images, consolidated CSS for the redesigned views, accessible status updates and the reviewer pass | Check narrow screens, 200% zoom, visible focus, 44 px touch targets, reduced motion, readable contrast and slow connections. Verify the camera and file picker on Android and iOS. |

The first prototype can use the current React/Vite and CSS stack. Proposed measures are targets for future testing. The evidence above comes from the implementation and local app flow. Classroom rehearsal should guide the final type sizes, comparison layout and pace.
