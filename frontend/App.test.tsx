import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import App from './App';
import type {Prediction, Source} from './types';

const fetchMock = vi.fn();
const blue = {
  id: 'portunus-pelagicus', scientific_name: 'Portunus pelagicus', english_name: 'Blue swimming crab',
  names: [], sources: [] as Source[], edibility: 'reported_food_use', toxicity: 'unknown',
  habitat: 'Sandy beaches.', distribution: 'Indo-West Pacific.',
};
const threeSpot = {
  ...blue, id: 'portunus-sanguinolentus', scientific_name: 'Portunus sanguinolentus',
  english_name: 'Three-spot swimming crab',
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
    if (url.startsWith('/images/')) return {ok: true, blob: async () => new Blob(['example'], {type: 'image/jpeg'})};
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

  it('shows the full toxic warning in Overview and keeps a reminder in Sources', async () => {
    const warning = {id: 'bfar', title: 'BFAR poisonous crab advisory', url: 'https://pia.gov.ph/news/beware-of-deadly-crabs-bfar/'};
    const devil = {...blue, id: 'zosimus-aeneus', english_name: 'Devil crab', scientific_name: 'Zosimus aeneus',
      edibility: 'not_recommended', toxicity: 'toxic', sources: [warning]};
    mockApi({catalog: [devil]});
    history.replaceState(null, '', '/#/field-guide/zosimus-aeneus');
    render(<App/>);
    const overview = await screen.findByRole('tabpanel', {name: 'Overview'});
    expect(within(overview).getByText(/^Toxic species$/).closest('.specimen-toxic')).toBeVisible();
    expect(within(overview).getByText('Do not eat this crab, even if cooked.')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', {name: 'Sources'}));
    expect(screen.getByRole('link', {name: warning.title})).toHaveAttribute('href', warning.url);
    expect(screen.getByRole('heading', {name: 'Crab nutrition'})).toBeVisible();
    const sources = screen.getByRole('tabpanel', {name: 'Sources'});
    expect(within(sources).getByText('Do not eat this crab, even if cooked.').closest('.specimen-toxic-reminder')).toBeVisible();
    expect(sources.querySelector('.specimen-toxic')).toBeNull();
  });

  it('shows one species panel at a time and supports keyboard navigation between tabs', async () => {
    history.replaceState(null, '', '/#/field-guide/portunus-pelagicus');
    render(<App/>);
    const overview = await screen.findByRole('tab', {name: 'Overview', selected: true});
    expect(screen.getByRole('tabpanel', {name: 'Overview'})).toBeVisible();
    expect(screen.queryByRole('heading', {name: 'What to look for'})).not.toBeInTheDocument();
    overview.focus();
    fireEvent.keyDown(overview, {key: 'ArrowRight'});
    const information = screen.getByRole('tab', {name: 'Crab info', selected: true});
    expect(information).toHaveFocus();
    expect(within(screen.getByRole('tabpanel', {name: 'Crab info'})).getByRole('heading', {name: 'What to look for'})).toBeVisible();
    expect(screen.queryByRole('tabpanel', {name: 'Overview'})).not.toBeInTheDocument();
    fireEvent.keyDown(information, {key: 'End'});
    expect(screen.getByRole('tab', {name: 'Sources', selected: true})).toHaveFocus();
    fireEvent.click(screen.getByRole('tab', {name: 'Nutrition'}));
    expect(within(screen.getByRole('tabpanel', {name: 'Nutrition'})).getByRole('heading', {name: 'Nutrition'})).toBeVisible();
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

  it('opens the upload picker and submits a photo from the homepage hero', async () => {
    render(<App/>);
    const picker = within(screen.getByRole('group', {name: 'Identify a crab photo'}));
    const library = picker.getByLabelText('Choose crab photograph');
    const openLibrary = vi.spyOn(library, 'click');
    fireEvent.click(picker.getByRole('button', {name: 'Upload photo'}));
    expect(openLibrary).toHaveBeenCalledOnce();
    fireEvent.change(library, {target: {files: [new File(['photo'], 'crab.jpg', {type: 'image/jpeg'})]}});
    expect(await picker.findByRole('img', {name: 'Your selected crab photograph'})).toBeInTheDocument();
    expect(location.hash).toBe('');
    const identify = picker.getByRole('button', {name: 'Identify crab'});
    await waitFor(() => expect(identify).toBeEnabled());
    fireEvent.click(identify);
    expect(await screen.findByRole('heading', {name: 'Match uncertain'})).toBeInTheDocument();
    expect(location.hash).toBe('#/observations/prediction-id');
  });

  it('submits a credited example and restores the chosen comparison after visiting a species', async () => {
    render(<App/>);
    fireEvent.click(await screen.findByRole('link', {name: 'Open Blue swimming crab'}));
    fireEvent.click(await screen.findByRole('button', {name: /Try this example photo/}));
    expect(await screen.findByRole('img', {name: 'Selected example crab'})).toBeInTheDocument();
    expect(location.hash).toBe('#/field-guide');
    fireEvent.click(await screen.findByRole('button', {name: /Identify crab/}));
    expect(await screen.findByRole('heading', {name: 'Match uncertain'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Example photo'})).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/uploads', expect.objectContaining({method: 'POST', body: expect.any(FormData)}));
    const matches = within(screen.getByRole('group', {name: 'Model suggestions'}));
    expect(matches.getByRole('button', {name: /Three-spot swimming crab/})).toHaveTextContent('58%');
    const candidate = matches.getByRole('button', {name: /Blue swimming crab/});
    expect(candidate).toHaveTextContent('34%');
    fireEvent.click(candidate);
    expect(candidate).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('link', {name: /Open species entry/}));
    fireEvent.click(await screen.findByRole('link', {name: 'Back to comparison'}));
    expect(await screen.findByRole('button', {name: /Blue swimming crab/})).toHaveAttribute('aria-pressed', 'true');
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
    'uses consistent wording and shows the direct species facts only for %s',
    async (status, title) => {
      mockApi({prediction: {...result, candidates: [result.candidates[1]], status, reason: status === 'identified' ? null : 'ambiguous_species'}});
      history.replaceState(null, '', '/#/observations/prediction-id');
      render(<App/>);
      expect(await screen.findByRole('heading', {name: title})).toBeInTheDocument();
      expect(within(screen.getByRole('group', {name: 'Model suggestions'})).getByRole('button')).toHaveTextContent('34%');
      if (status === 'identified') {
        expect(await screen.findByRole('region', {name: 'Identified species details'})).toHaveTextContent('Reported food use');
      } else {
        expect(screen.queryByRole('region', {name: 'Identified species details'})).not.toBeInTheDocument();
      }
    },
  );

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
    const retakePhoto = comparison.getByRole('img', {name: /dark, blurry close-up/});
    expect(clearPhoto).toHaveAttribute('src', retakePhoto.getAttribute('src'));
    expect(comparison.getByText('Good photo')).toBeInTheDocument();
    expect(comparison.getByText('Retake')).toBeInTheDocument();
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
