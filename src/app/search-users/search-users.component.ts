import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, filter, forkJoin, map, merge, mergeMap, of, startWith, Subject, switchMap, takeUntil } from 'rxjs';
import { User, UsersResponse, userTableData } from '../types';

@Component({
  selector: 'app-search-users',
  templateUrl: './search-users.component.html',
  styleUrls: ['./search-users.component.scss']
})
export class SearchUsersComponent implements OnInit {
  displayedColumns: string[] = ['avatar_url', 'name', 'followers', 'location'];
  data: userTableData[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  searchInputControl = new FormControl();

  basic_url = 'https://api.github.com';
  resultsLength = 0;
  isLoadingResults = false;
  isRateLimitReached = false;

  value!: string;

  private destroy$ = new Subject();

  constructor(private http: HttpClient) { }

  ngOnInit(): void { }

  ngAfterViewInit() {
    // If the user changes the sort order, reset back to the first page.
    this.sort.sortChange.subscribe(() => (this.paginator.pageIndex = 0));
    const searchInput$ = this.searchInputControl.valueChanges
      .pipe(
        filter(value => value.length > 2),
        debounceTime(1000),
        distinctUntilChanged()
      );

    const sort$ = this.sort.sortChange;
    const paginator$ = this.paginator.page;
    merge(searchInput$, sort$, paginator$).pipe(
      takeUntil(this.destroy$),
      switchMap(value => {
        this.isLoadingResults = true;
        this.isRateLimitReached = false;
        return this.http.get<UsersResponse>(`${this.basic_url}/search/users?q=${this.searchInputControl.value}&sort=${this.sort.active}&order=${this.sort.direction}&page=${this.paginator.pageIndex + 1
          }&per_page=${this.paginator.pageSize}`)
          .pipe(
            switchMap((res: UsersResponse) => {
              this.resultsLength = res.total_count;
              return forkJoin(
                res.items.map((item: User) => this.http.get<userTableData>(`${this.basic_url}/users/${item.login}`))
              ).pipe(
                catchError(err => {
                  this.isLoadingResults = false;
                  this.isRateLimitReached = true;
                  return EMPTY;
                })
              )
            }),
            catchError(err => {
              this.isLoadingResults = false;
              return EMPTY;
            })
          );
      })
    ).subscribe(data => {
      this.data = data;
      this.isLoadingResults = false;
    })
  }

  rowClick(row: userTableData) {
    window.open(row.html_url, '_blank');
  }

  ngOnDestroy() {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

}
