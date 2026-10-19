import {describe,it,expect} from 'vitest';
import {validateFile} from './api';
describe('upload validation',()=>{
  it('rejects non-images and empty images',()=>{expect(validateFile(new File(['<svg/>'],'a.svg',{type:'image/svg+xml'}))).toMatch(/JPEG/);expect(validateFile(new File([],'a.png',{type:'image/png'}))).toMatch(/empty/);});
  it('accepts a supported nonempty image',()=>{expect(validateFile(new File(['bytes'],'a.jpg',{type:'image/jpeg'}))).toBeNull();});
  it('rejects files above the size budget',()=>{expect(validateFile(new File([new Uint8Array(10*1024*1024+1)],'a.png',{type:'image/png'}))).toMatch(/10 MiB/);});
});
