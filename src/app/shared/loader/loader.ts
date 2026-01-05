import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule
import { LoaderService } from '../../services/loader/loader'; // Import LoaderService

@Component({
  standalone:true,
  selector: 'app-loader',
  imports: [CommonModule], // Add imports array for standalone components
  templateUrl: './loader.html',
  styleUrls: ['./loader.css']
})
export class LoaderComponent {
  constructor(public loaderService: LoaderService) {}
}
