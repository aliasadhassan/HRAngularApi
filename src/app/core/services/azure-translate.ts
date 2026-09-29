import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment'; // Apne project ke mutabiq path sahi kar lein

@Injectable({ providedIn: 'root' })
export class AzureTranslateService {
  private http = inject(HttpClient);

  // Key ko yahan direct rakhne ki jagah environment se uthayein
  private apiKey = environment.azureApiKey || ''; 
  private endpoint = '/azure-api'; 
  private region = 'eastus'; 

  /**
   * Kisi bhi text ko target language mein translate karne ka method
   * @param text Original text jo translate karna hai
   * @param targetLang Target language code (e.g., 'ar' for Arabic, 'en' for English)
   */
  translateText(text: string, targetLang: string): Observable<any> {
    const url = `${this.endpoint}/translate?api-version=3.0&to=${targetLang}`;

    const headers = new HttpHeaders({
      'Ocp-Apim-Subscription-Key': this.apiKey,
      'Ocp-Apim-Subscription-Region': this.region,
      'Content-Type': 'application/json'
    });

    const body = [{ Text: text }];

    return this.http.post(url, body, { headers });
  }
}