import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError
} from '@angular/router';

import { LoaderComponent } from './shared/loader/loader';
import { AlertComponent } from './shared/alert/alert';
import { LoaderService } from './services/loader/loader';
import { AlertService } from './services/alert/alert';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs';

import { MsalService, MsalBroadcastService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { AuthService } from './auth/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    LoaderComponent,
    AlertComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit, OnDestroy {

  protected readonly title = signal('HR Core');

  private routerSub?: Subscription;

  constructor(
    private alert: AlertService,
    private router: Router,
    private loader: LoaderService,
    private msalService: MsalService,
    private msalBroadcastService: MsalBroadcastService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.routerSub = this.router.events.subscribe(event => {

      if (event instanceof NavigationStart) {
        this.loader.show();
        this.alert.clear();
      }

      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.loader.hide();
      }
    });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }
}