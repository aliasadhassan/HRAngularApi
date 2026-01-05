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

@Component({
  selector: 'app-root',
  standalone: true, // 🔥 REQUIRED for standalone apps
  imports: [
    RouterOutlet,
    LoaderComponent,
    AlertComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css'] // 🔥 FIXED
})
export class AppComponent implements OnInit, OnDestroy {

  protected readonly title = signal('HR Core');

  private routerSub?: Subscription;

  constructor(
    private alert: AlertService,
    private router: Router,
    private loader: LoaderService
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
        this.loader.hide();     // 🔥 loader stop
      }
    });
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe(); // 🟢 best practice
  }
}
