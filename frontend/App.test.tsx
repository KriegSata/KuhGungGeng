import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import App from './App';
const fetchMock=vi.fn();
beforeEach(()=>{vi.stubGlobal('fetch',fetchMock);fetchMock.mockImplementation(async(url:string)=>({ok:true,status:200,json:async()=>url.endsWith('/session')?{csrf_token:'token'}:url.endsWith('/model')?{available:false}:{items:[]}}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
describe('identification interface',()=>{
 it('shows a locally hosted species photo, credit, and searchable guide cards',async()=>{
  const species={id:'scylla-serrata',scientific_name:'Scylla serrata',english_name:'Giant mud crab',names:[],toxicity:'unknown',habitat:'Mangrove estuaries.'};
  fetchMock.mockImplementation(async(url:string)=>({ok:true,status:200,json:async()=>url.endsWith('/session')?{csrf_token:'token'}:url.endsWith('/model')?{available:true}:{items:[species]}}));
  render(<App/>);
  await waitFor(()=>expect(fetchMock).toHaveBeenCalledWith('/api/species',expect.anything()));
  fireEvent.click(screen.getByRole('button',{name:'Field guide'}));
  const photo=await screen.findByRole('img',{name:'Scylla serrata reference photograph'});
  expect(photo).toHaveAttribute('src','/images/species/scylla-serrata.jpg');
  expect(screen.getByRole('link',{name:'Photo: OpenCage'})).toHaveAttribute('href',expect.stringContaining('commons.wikimedia.org/wiki/File:'));
  expect(screen.getByRole('button',{name:'View Giant mud crab'})).toBeInTheDocument();
  fireEvent.error(photo);
  expect(screen.getByText('Reference photo unavailable')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox',{name:'Search species'}),{target:{value:'not-a-species'}});
  expect(screen.getByText('No species found. Try another name.')).toBeInTheDocument();
 });
 it.each([
  ['identified','unknown','Not established'],
  ['identified','diet_related_risk_reported','Diet-related poisoning reported'],
  ['insufficient_information','unknown',null],
 ])('shows species facts only for an identified result (%s, %s)',async(status,toxicity,expected)=>{
  const species={id:'test-crab',scientific_name:'Test crab',english_name:'Reference crab',names:[],sources:[{id:'ref',title:'Reference source',url:'https://example.org/reference'}],edibility:'reported_food_use',toxicity,habitat:'Sandy beaches.',distribution:'Indo-West Pacific.'};
  const prediction={id:'prediction-id',upload_id:'upload-id',status,reason:status==='identified'?null:'ambiguous_species',candidates:[{species_id:'test-crab',scientific_name:'Test crab',confidence:.95,names:[]}],quality_warnings:[],suggested_photos:[],confidence_explanation:'Experimental scores.',photo_guidance:'Keep your distance.',safety_disclaimer:'Do not eat based on this result.',model_version:'experimental'};
  fetchMock.mockImplementation(async(url:string)=>({ok:true,status:200,json:async()=>url.endsWith('/session')?{csrf_token:'token'}:url.endsWith('/model')?{available:true}:url.endsWith('/species')?{items:[species]}:url.endsWith('/uploads')?{id:'upload-id'}:prediction}));
  vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue({width:640,height:480,close:vi.fn()}));
  const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:photo');
  const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  render(<App/>);
  fireEvent.change(screen.getByLabelText('Choose crab photograph'),{target:{files:[new File(['photo'],'crab.jpg',{type:'image/jpeg'})]}});
  const identify=screen.getByRole('button',{name:'Identify crab'});
  await waitFor(()=>expect(identify).toBeEnabled());fireEvent.click(identify);
  expect(await screen.findByRole('button',{name:/Test crab/})).toHaveTextContent('Reference crab');
  expect(screen.getByRole('heading',{name:status==='identified'?'Confident identification':'Uncertain identification'})).toBeInTheDocument();
  if(expected){
   expect(screen.getByRole('region',{name:'Identified species details'})).toBeInTheDocument();
   expect(screen.getByText(expected)).toBeInTheDocument();
   expect(screen.getByText('Reported food use')).toBeInTheDocument();
   expect(screen.getByText('Sandy beaches.')).toBeInTheDocument();
   expect(screen.getByText('Indo-West Pacific.')).toBeInTheDocument();
  }else expect(screen.queryByRole('region',{name:'Identified species details'})).not.toBeInTheDocument();
  cleanup();create.mockRestore();revoke.mockRestore();
 });
 it('discloses the missing model and keeps inference disabled without an image',async()=>{render(<App/>);expect(await screen.findByText('Identification model awaiting validation')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Identify crab'})).toBeDisabled();expect(screen.getByText(/Never used for training/)).toBeInTheDocument();});
 it('navigates to private observation history',async()=>{render(<App/>);await waitFor(()=>expect(fetchMock).toHaveBeenCalledWith('/api/species',expect.anything()));fireEvent.click(screen.getByRole('button',{name:'My observations'}));expect(await screen.findByText('Your next discovery starts here.')).toBeInTheDocument();});
 it('shows API errors without inventing results',async()=>{fetchMock.mockResolvedValue({ok:false,status:503,json:async()=>({error:{message:'API is unavailable'}})});render(<App/>);expect(await screen.findByRole('alert')).toHaveTextContent('API is unavailable');});
 it('uploads a selected photograph and displays an honest abstention',async()=>{
  vi.stubGlobal('createImageBitmap',vi.fn().mockResolvedValue({width:640,height:480,close:vi.fn()}));
  const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:photo');
  const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  fetchMock.mockImplementation(async(url:string)=>({ok:true,status:200,json:async()=>url.endsWith('/session')?{csrf_token:'token'}:url.endsWith('/model')?{available:false}:url.endsWith('/uploads')?{id:'upload-id'}:url.endsWith('/predictions')?{id:'prediction-id',upload_id:'upload-id',status:'insufficient_information',reason:'model_unavailable',candidates:[],quality_warnings:[],suggested_photos:['dorsal'],confidence_explanation:'Scores are not food safety.',photo_guidance:'Do not handle the animal.',safety_disclaimer:'Do not consume based on this result.',model_version:'unavailable'}:{items:[]}}));
  render(<App/>);
  fireEvent.change(screen.getByLabelText('Choose crab photograph'),{target:{files:[new File(['photo'],'crab.jpg',{type:'image/jpeg'})]}});
  const identify=screen.getByRole('button',{name:'Identify crab'});
  await waitFor(()=>expect(identify).toBeEnabled());fireEvent.click(identify);
  expect(await screen.findByText('Uncertain identification')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/uploads',expect.objectContaining({method:'POST',body:expect.any(FormData)}));
  expect(screen.getByText('No validated identification model is installed. Your image was processed, but no species prediction was made.')).toBeInTheDocument();
  const dialog=await screen.findByRole('dialog',{name:'Uncertain identification'});
  expect(dialog).toHaveAttribute('open');
  fireEvent.click(screen.getByRole('button',{name:'Close prediction'}));
  await waitFor(()=>expect(dialog).not.toHaveAttribute('open'));
  fireEvent.click(screen.getByRole('button',{name:/View last result/}));
  await waitFor(()=>expect(dialog).toHaveAttribute('open'));
  fireEvent(dialog,new Event('cancel',{bubbles:false,cancelable:true}));
  await waitFor(()=>expect(dialog).not.toHaveAttribute('open'));
  cleanup();create.mockRestore();revoke.mockRestore();
 });
});
