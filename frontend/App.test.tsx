import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import App from './App';
const fetchMock=vi.fn();
beforeEach(()=>{vi.stubGlobal('fetch',fetchMock);fetchMock.mockImplementation(async(url:string)=>({ok:true,status:200,json:async()=>url.endsWith('/session')?{csrf_token:'token'}:url.endsWith('/model')?{available:false}:{items:[]}}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
describe('identification interface',()=>{
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
  expect(await screen.findByText('Not enough information to identify this crab')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/uploads',expect.objectContaining({method:'POST',body:expect.any(FormData)}));
  expect(screen.getByText('No validated identification model is installed. Your image was processed, but no species prediction was made.')).toBeInTheDocument();
  cleanup();create.mockRestore();revoke.mockRestore();
 });
});
