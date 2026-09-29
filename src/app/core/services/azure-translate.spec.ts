import { TestBed } from '@angular/core/testing';

import { AzureTranslate } from './azure-translate';

describe('AzureTranslate', () => {
  let service: AzureTranslate;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AzureTranslate);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
