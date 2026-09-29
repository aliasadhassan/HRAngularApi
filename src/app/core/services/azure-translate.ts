import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AzureTranslateService {
  private http = inject(HttpClient);

  // Subscription key/region are added server-side by the dev proxy (proxy.conf.mjs),
  // so the key never ships in the browser bundle.
  private endpoint = '/azure-api';

  translateText(text: string, targetLang: string): Observable<any> {
    const url = `${this.endpoint}/translate?api-version=3.0&to=${targetLang}`;
    const body = [{ Text: text }];

    return this.http.post(url, body);
  }
}
