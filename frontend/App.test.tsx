import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import App from './App';
import type {Prediction} from './types';

const fetchMock = vi.fn();
const blue = {
  id: 'portunus-pelagicus', scientific_name: 'Portunus pelagicus', english_name: 'Blue swimming crab',
  names: [], sources: [], edibility: 'reported_food_use', toxicity: 'unknown',
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
    render(<App/>);
    const featured = await screen.findByRole('link', {name: 'Open Blue swimming crab'});
    const photo = featured.querySelector('img');
    expect(photo).toHaveAttribute('src', '/images/species/portunus-pelagicus.jpg');
    expect(screen.getAllByRole('link', {name: /^Photo:/}).length).toBeGreaterThan(1);
    fireEvent.error(photo!);
    expect(screen.getByText('Reference photo unavailable')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', {name: 'Search species'}), {target: {value: 'sanguinolentus'}});
    expect(screen.queryByRole('link', {name: 'View Blue swimming crab'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View Three-spot swimming crab'})).toBeInTheDocument();
  });

  it('submits a credited example and restores the chosen comparison after visiting a species', async () => {
    render(<App/>);
    fireEvent.click(await screen.findByRole('link', {name: 'Open Blue swimming crab'}));
    fireEvent.click(await screen.findByRole('button', {name: /Try this example photo/}));
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
    history.replaceState(null, '', '/#/identify');
    render(<App/>);
    expect(await screen.findByText('The identification model is unavailable.')).toBeInTheDocument();
    expect(screen.getByText(/Never used for training/)).toBeInTheDocument();
  });

  it('shows a retry when the catalog cannot load', async () => {
    fetchMock.mockResolvedValue(failure('API is unavailable'));
    render(<App/>);
    expect(await screen.findByRole('alert')).toHaveTextContent('API is unavailable');
    expect(screen.getByRole('button', {name: 'Try again'})).toBeInTheDocument();
  });
});
