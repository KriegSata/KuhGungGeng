import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import App from './App';
import type {Prediction, Source} from './types';

const fetchMock = vi.fn();
const blue = {
  id: 'portunus-pelagicus', scientific_name: 'Portunus pelagicus', english_name: 'Blue swimming crab',
  names: [], sources: [] as Source[], edibility: 'reported_food_use', toxicity: 'unknown',
  habitat: 'Sandy beaches.', distribution: 'Indo-West Pacific.',
  diagnostic_traits: ['Look for a long spine on either side of the shell.'],
};
const threeSpot = {
  ...blue, id: 'portunus-sanguinolentus', scientific_name: 'Portunus sanguinolentus',
  english_name: 'Three-spot swimming crab',
  diagnostic_traits: ['Check for three wine-red spots across the back of the shell.'],
};
const result: Prediction = {
  id: 'prediction-id', upload_id: 'upload-id', status: 'insufficient_information', reason: 'ambiguous_species',
  created_at: Date.now() / 1000, experimental: true, model_version: 'experimental',
  candidates: [threeSpot, blue].map((item, index) => ({...item, species_id: item.id, confidence: index === 0 ? .58 : .34})),
  ood: {detected: null, score: null, method: 'not_evaluated'},
  quality_warnings: [], suggested_photos: ['dorsal'], confidence_explanation: 'Experimental scores.',
  photo_guidance: 'Keep your distance.', safety_disclaimer: 'Do not eat based on this result.',
};
const ok = (data: unknown) => ({ok: true, status: 200, json: async () => data});
const failure = (message: string) => ({ok: false, status: 503, json: async () => ({error: {message}})});

function mockApi({prediction = result, available = true, catalog = [blue, threeSpot]} = {}) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/session') return ok({csrf_token: 'token'});
    if (url === '/api/model') return ok({available, version: 'experimental', species_ids: [blue.id, threeSpot.id]});
    if (url === '/api/species') return ok({items: catalog});
    if (url === '/api/uploads') return ok({id: 'upload-id'});
    if (url === '/api/predictions') return ok(prediction);
    if (url === '/api/predictions/prediction-id') return ok(prediction);
    throw new Error('Unexpected endpoint ' + url);
  });
}

beforeEach(() => {
  history.replaceState(null, '', '/');
  sessionStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({width: 640, height: 480, close: vi.fn()}));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:photo');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  mockApi();
});
afterEach(() => {cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); fetchMock.mockReset();});

describe('Shellfie classroom demo', () => {
  it('does not start the featured slideshow on mobile', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: false,
      addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    const interval = vi.spyOn(window, 'setInterval');
    render(<App/>);
    await screen.findByRole('region', {name: 'Featured crabs'});
    expect(interval.mock.calls.some(([, delay]) => delay === 20_000)).toBe(false);
  });

  it('advances featured species after 20 seconds and pauses while hovered', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({matches: query === '(min-width: 761px)',
      addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    render(<App/>);
    const carousel = await screen.findByRole('region', {name: 'Featured crabs'});
    vi.useFakeTimers();
    try {
      fireEvent.mouseEnter(carousel);
      await act(async () => { await vi.advanceTimersByTimeAsync(25_000); });
      expect(within(carousel).getByRole('link', {name: 'Open Blue swimming crab'})).toBeInTheDocument();
      fireEvent.mouseLeave(carousel);
      await act(async () => { await vi.advanceTimersByTimeAsync(19_999); });
      expect(within(carousel).getByRole('link', {name: 'Open Blue swimming crab'})).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(201); });
      expect(within(carousel).getByRole('link', {name: 'Open Three-spot swimming crab'})).toBeInTheDocument();
      expect(within(carousel).getByText('Portunus sanguinolentus')).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(650); });
      expect(carousel).toHaveAttribute('data-phase', 'idle');
      fireEvent.focus(within(carousel).getByRole('link', {name: 'Open Three-spot swimming crab'}));
      await act(async () => { await vi.advanceTimersByTimeAsync(25_000); });
      expect(within(carousel).getByRole('link', {name: 'Open Three-spot swimming crab'})).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('opens a searchable field guide with a locally hosted featured photo and credits', async () => {
    mockApi({catalog: [blue, threeSpot, {...blue, id: 'atergatis-floridus', english_name: 'Floral egg crab',
      scientific_name: 'Atergatis floridus', toxicity: 'toxic'}]});
    render(<App/>);
    const featured = await screen.findByRole('link', {name: 'Open Blue swimming crab'});
    const photo = featured.querySelector('img');
    expect(photo).toHaveAttribute('src', '/images/species/portunus-pelagicus.jpg');
    expect(screen.getAllByRole('link', {name: /^Photo:/}).length).toBeGreaterThan(1);
    const toxicCard = screen.getByRole('link', {name: 'View Floral egg crab'});
    expect(within(toxicCard).getByText('Toxic species')).toBeInTheDocument();
    expect(toxicCard).toHaveAccessibleDescription('Toxic species');
    fireEvent.error(photo!);
    expect(screen.getByText('Reference photo unavailable')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', {name: 'Search species'}), {target: {value: 'sanguinolentus'}});
    expect(screen.queryByRole('link', {name: 'View Blue swimming crab'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View Three-spot swimming crab'})).toBeInTheDocument();
  });

  it('combines habitat filters with name search and restores the filter after viewing a profile', async () => {
    const ghost = {...blue, id: 'ocypode-ceratophthalma', english_name: 'Horn-eyed ghost crab',
      scientific_name: 'Ocypode ceratophthalma', habitat: 'Burrows in sandy upper beaches.'};
    const land = {...blue, id: 'cardisoma-carnifex', english_name: 'Mangrove land crab',
      scientific_name: 'Cardisoma carnifex', habitat: 'Coastal burrows behind mangroves.'};
    const reef = {...blue, id: 'atergatis-floridus', english_name: 'Floral egg crab',
      scientific_name: 'Atergatis floridus', habitat: 'Shallow coral and rocky reefs.', toxicity: 'toxic'};
    mockApi({catalog: [ghost, land, reef]});
    render(<App/>);

    const filters = within(await screen.findByRole('group', {name: 'Filter by habitat'}));
    expect(filters.getByRole('button', {name: 'All habitats'})).toHaveAttribute('aria-expanded', 'false');
    expect(filters.queryByRole('button', {name: 'Beach'})).not.toBeInTheDocument();
    fireEvent.click(filters.getByRole('button', {name: 'All habitats'}));
    expect(filters.getByRole('button', {name: 'All habitats', expanded: true})).toBeVisible();
    fireEvent.click(filters.getByRole('button', {name: 'Beach'}));
    expect(filters.getByRole('button', {name: 'Beach'})).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('link', {name: 'View Horn-eyed ghost crab'})).toBeVisible();
    expect(screen.queryByRole('link', {name: 'View Floral egg crab'})).not.toBeInTheDocument();
    fireEvent.click(filters.getByRole('button', {name: 'Beach'}));
    fireEvent.click(filters.getByRole('button', {name: 'Mangrove'}));
    expect(screen.getByRole('link', {name: 'View Mangrove land crab'})).toBeVisible();
    fireEvent.click(filters.getByRole('button', {name: 'Mangrove'}));
    fireEvent.click(filters.getByRole('button', {name: 'Reef'}));
    const search = screen.getByRole('searchbox', {name: 'Search species'});
    fireEvent.change(search, {target: {value: 'Atergatis'}});
    fireEvent.click(screen.getByRole('link', {name: 'View Floral egg crab'}));
    fireEvent.click(await screen.findByRole('link', {name: 'Back to the field guide'}));

    const restoredSearch = await screen.findByRole('searchbox', {name: 'Search species'});
    expect(restoredSearch).toHaveValue('Atergatis');
    expect(screen.getByRole('button', {name: 'Reef'})).toHaveAttribute('aria-expanded', 'false');
    fireEvent.change(restoredSearch, {target: {value: 'Ocypode'}});
    expect(screen.getByText('No species match these filters.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: 'Clear filters'}));
    expect(restoredSearch).toHaveValue('');
    expect(restoredSearch).toHaveFocus();
  });

  it('shows the toxic warning and safety sources on the same page', async () => {
    const warning = {id: 'bfar', title: 'BFAR poisonous crab advisory', url: 'https://pia.gov.ph/news/beware-of-deadly-crabs-bfar/'};
    const devil = {...blue, id: 'zosimus-aeneus', english_name: 'Devil crab', scientific_name: 'Zosimus aeneus',
      edibility: 'not_recommended', toxicity: 'toxic', sources: [warning]};
    mockApi({catalog: [devil]});
    history.replaceState(null, '', '/#/field-guide/zosimus-aeneus');
    render(<App/>);
    const safetySources = await screen.findByRole('button', {name: 'View safety sources'});
    expect(safetySources).toHaveAccessibleDescription('Toxic species Do not eat this crab, even if cooked.');
    expect(screen.getByText('Do not eat this crab, even if cooked.')).toBeVisible();
    fireEvent.click(safetySources);
    expect(screen.getByRole('link', {name: warning.title})).toHaveAttribute('href', warning.url);
    expect(screen.getByRole('heading', {name: 'Crab nutrition'})).toBeVisible();
  });

  it('shows reported poisoning on the guide card and links its profile warning to the evidence', async () => {
    const risk = {id: 'seafdec-land-crab-risk', title: 'SEAFDEC safety handbook', url: 'https://repository.seafdec.org/'};
    const land = {...blue, id: 'cardisoma-carnifex', english_name: 'Mangrove land crab', scientific_name: 'Cardisoma carnifex',
      toxicity: 'diet_related_risk_reported', sources: [risk]};
    mockApi({catalog: [land]});
    render(<App/>);
    const card = await screen.findByRole('link', {name: 'View Mangrove land crab'});
    expect(card).toHaveAccessibleDescription('Poisoning risk reported');
    fireEvent.click(card);
    const banner = await screen.findByRole('button', {name: 'View safety sources'});
    expect(banner).toHaveAccessibleDescription(/Poisoning risk reported.*Severity in people is unverified/);
    fireEvent.click(banner);
    expect(screen.getByRole('link', {name: risk.title})).toHaveAttribute('href', risk.url);
  });

  it('shows a shared name link without adding a poisoning badge to a ghost crab', async () => {
    const ghost = {...blue, id: 'ocypode-ceratophthalma', english_name: 'Horn-eyed ghost crab',
      shared_local_name: {name: 'Agokoy', species_id: 'atergatis-floridus', species_name: 'floral egg crab'}};
    mockApi({catalog: [ghost]});
    history.replaceState(null, '', '/#/field-guide/' + ghost.id);
    render(<App/>);
    expect(await screen.findByText('Shared local name')).toBeVisible();
    expect(screen.getByRole('link', {name: 'floral egg crab'})).toHaveAttribute('href', '#/field-guide/atergatis-floridus');
    expect(screen.queryByRole('button', {name: 'View safety sources'})).not.toBeInTheDocument();
  });

  it('shows all species information together without tabs', async () => {
    history.replaceState(null, '', '/#/field-guide/portunus-pelagicus');
    render(<App/>);
    expect(await screen.findByRole('heading', {name: 'Species notes'})).toBeVisible();
    expect(screen.getByRole('heading', {name: 'What to look for'})).toBeVisible();
    expect(screen.getByRole('heading', {name: 'Nutrition'})).toBeVisible();
    expect(screen.getByRole('heading', {name: 'Sources'})).toBeVisible();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('opens a live camera from the hero and stops the stream when it closes', async () => {
    const stop = vi.fn();
    const stream = {getTracks: () => [{stop}]};
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal('navigator', Object.create(window.navigator, {mediaDevices: {value: {getUserMedia}}}));
    render(<App/>);
    const picker = within(screen.getByRole('group', {name: 'Identify a crab photo'}));
    const openLibrary = vi.spyOn(picker.getByLabelText('Choose crab photograph'), 'click');
    fireEvent.click(picker.getByRole('button', {name: 'Take a photo'}));
    const camera = await screen.findByRole('dialog', {name: 'Take a crab photo'});
    const preview = within(camera).getByLabelText('Live camera preview') as HTMLVideoElement;
    await waitFor(() => expect(preview.srcObject).toBe(stream));
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({audio: false, video: expect.objectContaining({facingMode: {ideal: 'environment'}})}));
    expect(openLibrary).not.toHaveBeenCalled();
    fireEvent.click(within(camera).getByRole('button', {name: 'Close camera'}));
    expect(stop).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', {name: 'Take a crab photo'})).not.toBeInTheDocument();
  });

  it('clears a selected photo and lets the user select and submit it again from the hero', async () => {
    render(<App/>);
    const picker = within(screen.getByRole('group', {name: 'Identify a crab photo'}));
    const library = picker.getByLabelText('Choose crab photograph');
    const openLibrary = vi.spyOn(library, 'click');
    fireEvent.click(picker.getByRole('button', {name: 'Upload photo'}));
    expect(openLibrary).toHaveBeenCalledOnce();
    const file = new File(['photo'], 'crab.jpg', {type: 'image/jpeg'});
    fireEvent.change(library, {target: {files: [file]}});
    expect(await picker.findByRole('img', {name: 'Your selected crab photograph'})).toBeInTheDocument();
    fireEvent.click(picker.getByRole('button', {name: 'Remove photo'}));
    expect(picker.queryByRole('img', {name: 'Your selected crab photograph'})).not.toBeInTheDocument();
    expect(picker.queryByRole('button', {name: 'Identify crab'})).not.toBeInTheDocument();
    expect(picker.getByRole('button', {name: 'Upload photo'})).toHaveFocus();
    fireEvent.change(library, {target: {files: [file]}});
    expect(await picker.findByRole('img', {name: 'Your selected crab photograph'})).toBeInTheDocument();
    expect(location.hash).toBe('');
    const identify = picker.getByRole('button', {name: 'Identify crab'});
    await waitFor(() => expect(identify).toBeEnabled());
    fireEvent.click(identify);
    expect(await screen.findByRole('heading', {name: 'Match uncertain'})).toBeInTheDocument();
    expect(location.hash).toBe('#/observations/prediction-id');
  });

  it('shows a saved example and restores the chosen comparison after visiting a species', async () => {
    mockApi({prediction: {...result, status: 'identified', reason: null}});
    sessionStorage.setItem('shellfie:example:' + result.id, blue.id);
    history.replaceState(null, '', '/#/observations/' + result.id);
    render(<App/>);
    expect(await screen.findByRole('heading', {name: 'Example photo'})).toBeInTheDocument();
    const matches = within(screen.getByRole('group', {name: 'Model suggestions'}));
    expect(matches.getByRole('button', {name: /Three-spot swimming crab/})).toHaveTextContent('58%');
    const candidate = matches.getByRole('button', {name: /Blue swimming crab/});
    expect(candidate).toHaveTextContent('34%');
    const reference = await screen.findByRole('region', {name: 'Selected species reference'});
    expect(within(reference).getByRole('heading', {name: threeSpot.english_name})).toBeVisible();
    fireEvent.click(candidate);
    expect(candidate).toHaveAttribute('aria-pressed', 'true');
    const selected = screen.getByRole('region', {name: 'Selected species reference'});
    expect(within(selected).getByRole('heading', {name: blue.english_name})).toBeVisible();
    fireEvent.click(within(selected).getByRole('link', {name: 'Full species profile'}));
    fireEvent.click(await screen.findByRole('link', {name: 'Back to comparison'}));
    expect(await screen.findByRole('button', {name: /Blue swimming crab/})).toHaveAttribute('aria-pressed', 'true');
  });

  it('updates the comparison cue on an uncertain result and enlarges either photo', async () => {
    history.replaceState(null, '', '/#/observations/' + result.id);
    render(<App/>);
    expect(await screen.findByText(threeSpot.diagnostic_traits[0])).toBeVisible();
    const overview = () => within(screen.getByRole('region', {name: 'Selected species reference'}));
    expect(overview().getByRole('heading', {name: threeSpot.english_name})).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: /Blue swimming crab/}));
    expect(screen.getByText(blue.diagnostic_traits[0])).toBeVisible();
    expect(screen.queryByText(threeSpot.diagnostic_traits[0])).not.toBeInTheDocument();
    expect(overview().getByRole('heading', {name: blue.english_name})).toBeVisible();
    expect(overview().getByRole('link', {name: 'Full species profile'})).toHaveAttribute('href', '#/field-guide/' + blue.id);

    for (const [label, src] of [
      ['your photo', '/api/uploads/upload-id/image'], ['reference photo', '/images/species/portunus-pelagicus.jpg'],
    ]) {
      fireEvent.click(screen.getByRole('button', {name: 'Enlarge ' + label}));
      const dialog = screen.getByRole('dialog', {name: 'Enlarged ' + label});
      expect(within(dialog).getByRole('img')).toHaveAttribute('src', src);
      const close = within(dialog).getByRole('button', {name: 'Close enlarged photo'});
      expect(close).toHaveFocus();
      fireEvent.click(close);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }

    fireEvent.error(screen.getByRole('img', {name: 'Portunus pelagicus reference photograph'}));
    expect(screen.getByText('Reference photo unavailable')).toBeVisible();
    expect(screen.queryByRole('button', {name: 'Enlarge reference photo'})).not.toBeInTheDocument();
  });

  it.each([[1, '100%'], [.9998, '>99.9%']] as const)(
    'explains an exposure warning alongside a top model score of %s',
    async (confidence, shownScore) => {
      const candidates = [
        {...result.candidates[0], confidence},
        {...result.candidates[1], confidence: confidence === 1 ? 0 : .0002},
      ];
      mockApi({prediction: {...result, reason: 'poor_image_quality', quality_warnings: ['underexposed'], candidates}});
      history.replaceState(null, '', '/#/observations/' + result.id);
      render(<App/>);

      expect(await screen.findByRole('heading', {name: 'Photo quality warning'})).toBeVisible();
      expect(screen.getByText(/Three-spot swimming crab scored highest/)).toBeVisible();
      const scores = within(screen.getByRole('group', {name: 'Model suggestions'}));
      expect(scores.getByText(shownScore, {exact: true})).toBeVisible();
      expect(scores.getByText(confidence === 1 ? '0%' : '<0.1%', {exact: true})).toBeVisible();
      expect(screen.getByRole('button', {name: 'Retake photo'})).toBeVisible();
      const overview = within(await screen.findByRole('region', {name: 'Selected species reference'}));
      expect(overview.getByRole('heading', {name: threeSpot.english_name})).toBeVisible();
    },
  );

  it('flags toxic and reported-risk candidates even when neither is selected', async () => {
    const floral = {...blue, id: 'atergatis-floridus', english_name: 'Floral egg crab', toxicity: 'toxic'};
    const land = {...blue, id: 'cardisoma-carnifex', english_name: 'Mangrove land crab', toxicity: 'diet_related_risk_reported'};
    const candidates = [result.candidates[0], {...floral, species_id: floral.id, confidence: .21},
      {...land, species_id: land.id, confidence: .13}];
    mockApi({prediction: {...result, candidates}, catalog: [threeSpot, floral]});
    history.replaceState(null, '', '/#/observations/' + result.id);
    render(<App/>);
    const matches = within(await screen.findByRole('group', {name: 'Model suggestions'}));
    expect(await matches.findByRole('button', {name: /Floral egg crab.*Toxic species.*21%/, pressed: false})).toBeVisible();
    expect(matches.getByRole('button', {name: /Mangrove land crab.*Poisoning risk reported.*13%/, pressed: false})).toBeVisible();
    expect(matches.getByRole('button', {pressed: true})).not.toHaveTextContent(/Poisoning risk reported|Toxic species/);
  });

  it('highlights the feature on the matching reference photo and its enlargement', async () => {
    const ghost = {...blue, id: 'ocypode-ceratophthalma', english_name: 'Horn-eyed ghost crab',
      scientific_name: 'Ocypode ceratophthalma', diagnostic_traits: ['Look for horn-like tips beyond the eyes.']};
    const candidates = [{...ghost, species_id: ghost.id, confidence: .58}, result.candidates[1]];
    mockApi({prediction: {...result, candidates}, catalog: [ghost, blue]});
    history.replaceState(null, '', '/#/observations/' + result.id);
    render(<App/>);

    const feature = await screen.findByRole('button', {name: 'Show this feature', pressed: false});
    const reference = screen.getByRole('img', {name: /Ocypode ceratophthalma reference photograph/});
    fireEvent.load(reference);
    fireEvent.click(feature);
    expect(feature).toHaveAttribute('aria-pressed', 'true');
    expect(document.getElementById(feature.getAttribute('aria-controls')!)).toHaveTextContent('Eyestalk horn');
    expect(reference).toHaveAccessibleName(/extends above the eye/);
    expect(screen.getByRole('img', {name: 'Crab photo submitted for identification'})).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Enlarge reference photo'}));
    const dialog = within(screen.getByRole('dialog', {name: 'Enlarged reference photo'}));
    expect(dialog.getByText('Eyestalk horn')).toBeVisible();
    fireEvent.click(dialog.getByRole('button', {name: 'Close enlarged photo'}));

    fireEvent.click(screen.getByRole('button', {name: /Blue swimming crab.*34%/}));
    expect(screen.queryByRole('button', {name: 'Show this feature'})).not.toBeInTheDocument();
    expect(screen.getByText(blue.diagnostic_traits[0])).toBeVisible();
    fireEvent.click(screen.getByRole('button', {name: /Horn-eyed ghost crab.*58%/}));
    expect(screen.getByRole('button', {name: 'Show this feature', pressed: false})).toBeVisible();
    fireEvent.error(screen.getByRole('img', {name: 'Ocypode ceratophthalma reference photograph'}));
    expect(screen.queryByRole('button', {name: 'Show this feature'})).not.toBeInTheDocument();
  });

  it('reuses a successful upload after a failed prediction and labels a personal photo', async () => {
    const respond = fetchMock.getMockImplementation()!;
    let failed = false;
    fetchMock.mockImplementation(async (url, options) => {
      if (url === '/api/predictions' && !failed) {
        failed = true;
        return failure('Please try again.');
      }
      return respond(url, options);
    });
    history.replaceState(null, '', '/#/identify');
    render(<App/>);
    fireEvent.change(screen.getByLabelText('Choose crab photograph'), {target: {files: [new File(['photo'], 'crab.jpg', {type: 'image/jpeg'})]}});
    const button = await screen.findByRole('button', {name: /Identify crab/});
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Please try again.');
    fireEvent.click(button);
    expect(await screen.findByRole('heading', {name: 'Your photo'})).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/uploads')).toHaveLength(1);
  });

  it.each([['identified', 'Possible match'], ['insufficient_information', 'Match uncertain']])(
    'shows the selected species facts while preserving result wording for %s',
    async (status, title) => {
      mockApi({prediction: {...result, candidates: [result.candidates[1]], status, reason: status === 'identified' ? null : 'ambiguous_species'}});
      history.replaceState(null, '', '/#/observations/prediction-id');
      render(<App/>);
      expect(await screen.findByRole('heading', {name: title})).toBeInTheDocument();
      expect(within(screen.getByRole('group', {name: 'Model suggestions'})).getByRole('button')).toHaveTextContent('34%');
      const reference = within(await screen.findByRole('region', {name: 'Selected species reference'}));
      expect(reference.getByText('Reported food use')).toBeVisible();
      expect(reference.getByRole('link', {name: 'Full species profile'})).toBeVisible();
      expect(screen.queryByRole('link', {name: 'Open species profile'})).not.toBeInTheDocument();
      if (status === 'identified') {
        expect(screen.queryByRole('heading', {name: 'Check another angle'})).not.toBeInTheDocument();
      } else {
        expect(screen.getByRole('heading', {name: 'Check another angle'})).toBeVisible();
      }
      expect(screen.queryByRole('button', {name: 'Retake photo'})).not.toBeInTheDocument();
    },
  );

  it('opens the camera on a blurry result and identifies a replacement photo from the same page', async () => {
    const blurry = {...result, reason: 'poor_image_quality', quality_warnings: ['possible_blur_or_low_detail']};
    const next = {...result, id: 'retake-result', upload_id: 'retake-upload', status: 'identified', reason: null};
    mockApi({prediction: blurry});
    const respond = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url, options) => {
      if (url === '/api/uploads') return ok({id: next.upload_id});
      if (url === '/api/predictions' && options.method === 'POST') return ok(next);
      return respond(url, options);
    });
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('Camera permission denied', 'NotAllowedError'));
    vi.stubGlobal('navigator', Object.create(window.navigator, {mediaDevices: {value: {getUserMedia}}}));
    history.replaceState(null, '', '/#/observations/' + blurry.id);
    render(<App/>);

    const tip = within(await screen.findByRole('region', {name: 'The photo may be blurry'}));
    expect(tip.getByText(/tap the shell to focus/)).toBeVisible();
    fireEvent.click(tip.getByRole('button', {name: 'Retake photo'}));
    const camera = within(await screen.findByRole('dialog', {name: 'Take a crab photo'}));
    expect(await camera.findByRole('alert')).toHaveTextContent('Camera access was blocked');
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(location.hash).toBe('#/observations/' + blurry.id);
    const input = tip.getByLabelText('Choose crab photograph');
    const openLibrary = vi.spyOn(input, 'click');
    fireEvent.click(camera.getByRole('button', {name: 'Upload instead'}));
    expect(openLibrary).toHaveBeenCalledOnce();
    fireEvent.change(input, {target: {files: [new File(['replacement'], 'retake.jpg', {type: 'image/jpeg'})]}});
    expect(await tip.findByRole('img', {name: 'Your selected crab photograph'})).toBeVisible();
    expect(location.hash).toBe('#/observations/' + blurry.id);
    fireEvent.click(tip.getByRole('button', {name: 'Identify crab'}));
    expect(await screen.findByRole('heading', {name: 'Possible match'})).toBeVisible();
    expect(location.hash).toBe('#/observations/' + next.id);
    expect(fetchMock).toHaveBeenCalledWith('/api/predictions', expect.objectContaining({
      method: 'POST', body: JSON.stringify({upload_id: next.upload_id, top_k: 3}),
    }));
  });

  it('keeps an expired uncertain observation readable and lets the user cancel deletion', async () => {
    const expired = {...result, created_at: Date.now() / 1000 - 90_000};
    const identified = {...result, id: 'identified-id', status: 'identified', reason: null,
      candidates: [{...result.candidates[1], english_name: undefined}]};
    const respond = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url, options) => url === '/api/predictions' ? ok({items: [identified, expired]}) : respond(url, options));
    history.replaceState(null, '', '/#/observations');
    render(<App/>);
    const unresolved = await screen.findByRole('link', {name: 'Unresolved observation'});
    expect(within(unresolved).getByText('Match uncertain')).toBeInTheDocument();
    expect(within(unresolved).getByText('Photo expired')).toBeInTheDocument();
    expect(unresolved).toHaveAccessibleDescription('Match uncertain Photo expired');
    expect(unresolved).not.toHaveTextContent(threeSpot.scientific_name);
    const match = await screen.findByRole('link', {name: blue.english_name});
    expect(within(match).getByText('Possible match')).toBeInTheDocument();
    expect(match).toHaveAttribute('href', '#/observations/identified-id');
    fireEvent.click(screen.getByRole('button', {name: 'Delete observation and photo for Unresolved observation'}));
    const dialog = screen.getByRole('dialog', {name: 'Delete this observation?'});
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(dialog).not.toHaveAttribute('open');
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false);
  });

  it('discloses an unavailable model after loading', async () => {
    mockApi({available: false});
    render(<App/>);
    fireEvent.change(screen.getByLabelText('Choose crab photograph'), {target: {files: [new File(['photo'], 'crab.jpg', {type: 'image/jpeg'})]}});
    expect(await screen.findByText('The identification model is unavailable.')).toBeInTheDocument();
  });

  it('shows photo guidance in its own tab and links back to the homepage picker', async () => {
    render(<App/>);
    fireEvent.click(screen.getByRole('link', {name: 'Photo tips'}));
    expect(await screen.findByRole('heading', {name: 'Photo tips'})).toBeInTheDocument();
    const comparison = within(screen.getByRole('region', {name: 'Good and poor crab photo examples'}));
    const clearPhoto = comparison.getByRole('img', {name: /sharp, bright photo/});
    const retakePhoto = comparison.getByRole('img', {name: /close crop/});
    expect(clearPhoto).toHaveAttribute('src', retakePhoto.getAttribute('src'));
    expect(comparison.getByText('Good photo')).toBeInTheDocument();
    expect(comparison.getByText('Retake')).toBeInTheDocument();
    expect(comparison.getByRole('button', {name: 'Framing', pressed: true})).toBeVisible();
    fireEvent.click(comparison.getByRole('button', {name: 'Focus'}));
    expect(comparison.getByRole('heading', {name: 'Details are blurry'})).toBeVisible();
    expect(retakePhoto).toHaveAccessibleName(/shell markings and legs are blurry/);
    fireEvent.click(comparison.getByRole('button', {name: 'Light'}));
    expect(comparison.getByRole('button', {name: 'Light', pressed: true})).toBeVisible();
    expect(retakePhoto).toHaveAccessibleName(/dark photo/);
    expect(clearPhoto).toHaveAccessibleName(/sharp, bright photo/);
    expect(screen.getByRole('heading', {name: 'Reading your results'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Upload photo'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', {name: 'Use the photo picker'}));
    expect(await screen.findByRole('button', {name: 'Upload photo'})).toBeInTheDocument();
  });

  it('shows a retry when the catalog cannot load', async () => {
    fetchMock.mockResolvedValue(failure('API is unavailable'));
    render(<App/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('API is unavailable');
    expect(screen.getByRole('button', {name: 'Try again'})).toBeInTheDocument();
  });
});
