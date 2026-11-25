# Shellfie UI and UX redesign

## Next design pass for the classroom demo

The logo gives Shellfie two useful qualities. The little crab leans into the frame as if it has spotted something, and the vivid blue makes its pale shell easy to see from a distance. Carry that sense of looking closely from the opening screen into the species photographs. Let a student finish the demo by pointing to one feature they compared.

### How the logo carries through

Use the existing cobalt `#0048FC` for the opening, shell yellow `#FFE4A2` for the main action on blue, pale periwinkle `#E6EBFF` for the photo surround, and navy `#17244B` for reading. Give the photo frame one gently curved edge that echoes the rim of the mascot’s shell. Keep specimen images rectangular inside that surround so legs and claws remain visible. Use the existing DM Sans, with large common names and quieter italic scientific names. Keep deep violet with a shield and explicit text for toxic species, and amber with the existing risk label for reported poisoning.

### Prototype these moments in order

| Priority | What the student sees and does | Behavior to design |
| --- | --- | --- |
| 1. Field guide opening | The mascot peeks in from the edge of the cobalt panel. **Take a photo** and **Upload photo** sit together. After selection the student sees their whole photo in the same space. | Let the mascot settle aside once as the preview appears. Keep **Identify crab** beside the preview and the small corner × within a generous tap target. On a phone, reserve room for the controls first. If camera permission is denied, keep Upload available beside the explanation. |
| 2. Identification results | All candidate percentages stay at the top. Selecting a candidate changes its reference photo and the existing **Look for** clue. A new **Show this feature** control highlights the named feature directly on a reference photo. | Start with one clearly visible feature on one credited image, such as an eye tip on the horn-eyed ghost crab after visual verification. Place the marker by hand and store it against that exact image. Keep the student's photo free of markers. Update the highlight and caption together, including in the enlarged view. Use the existing text clue alone when an image has no verified location. |
| 3. Field guide browsing | Beach, Mangrove and Reef each get a small recognizable illustration beside the existing label. The selected habitat has a clear outline and the count updates beside the species index. | Keep name search usable alongside the filters. Retain scroll reveals on first entry. On filter changes keep keyboard focus on the selected control and avoid replaying a long entrance across the grid. Restore the filter and place in the index when returning from a profile. |
| 4. Photo tips | Show the existing good and retake examples together. Under the retake example, let the student choose **Framing**, **Focus** or **Light** and see that single problem on the same specimen. | Pair each change with one actionable caption, such as “Leave space around both claws.” Stack the pair on narrow screens. Offer labeled buttons that work by touch and keyboard. |
| 5. Profiles and observations | Carry the same photo surround into Overview and the same photo caption style into the observation journal. Give the active sticky tab a short sliding underline. | Keep safety wording visible when opening Overview. Keep source, preparation and serving size attached to the selected nutrition sample. Give expired observation photos a quiet placeholder while retaining the species and date. |

### Build order and classroom checks

First prototype only the hero's empty and selected-photo states and one annotated match on phone and projector-sized layouts. Then connect the verified feature to the live comparison and reuse the pattern on additional images as each is checked. Finish the habitat, tips and profile refinements after the core walkthrough works.

Use the Anime.js dependency already in Shellfie for the coordinated photo transition. Aim for 160–240 ms for a state change. Use simple CSS for button presses and tab selection. Reduced-motion mode switches states immediately. Show scores, warnings, controls and errors as soon as they are available. Keep the uploaded photo readable if motion is interrupted, and cancel the previous transition when a student switches candidates quickly.

For the rehearsal, hand a phone to a classmate and ask them to upload a photo, compare two candidates and point to the feature they inspected. Ask a second person at the back of the room to read the score and any risk label. Repeat on a 320 px screen, with keyboard only and with reduced motion. Also try denied camera access, a blurry photo and a candidate without an annotation. These are proposed checks for the prototype.

---

## Original concept and early implementation notes

The notes below record the earlier direction. The next design pass above follows the current logo, homepage capture controls, visible scores and profile tabs.

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
