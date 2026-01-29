# HrUi

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

touch README.md

node -v
npm -v
npm install -g @angular/cli
npm install jwt-decode
===============================
ng version
===============================
Angular CLI       : 21.0.4
Node.js           : 22.17.1
Package Manager   : npm 10.9.2
Operating System  : win32 x64
===============================
ng generate component auth/login
ng generate component auth/register
ng generate service auth/auth
ng generate component dashboard
ng generate interceptor auth

ng generate component layout/dashboard-layout --standalone
ng generate component shared/sidebar --standalone
ng generate component shared/topbar --standalone
ng generate component shared/widgets --standalone

ng generate component pages/dashboard --standalone
ng generate component pages/employees --standalone
ng generate component pages/attendance --standalone
ng generate component pages/leaves --standalone
ng generate component pages/settings --standalone

ng generate guard auth/auth.guard
-- note : select canActivate

ng generate component shared/widgets/kpi-cards --standalone
ng generate interceptor token

npm install bootstrap-icons
npm install lucide-angular

ng generate component auth/forgot-password
ng generate component auth/reset-password

npm install @zxcvbn-ts/core @zxcvbn-ts/language-en @zxcvbn-ts/language-common
======================
docker file
======================
cd /c/Users/Shirjeel-Abid/source/repos     -- ye wo file path ha jaha py hmny .yml file rakhi ha docker ki
docker-compose down -v --remove-orphans
docker system prune --volumes -f
docker volume ls
docker-compose up --build -d
docker ps

docker-compose down
docker-compose up -d --force-recreate
docker volume prune -f
docker system prune -f
docker-compose up

docker-compose down -v

docker ps -a
docker stop $(docker ps -aq)
docker rm $(docker ps -aq)
docker volume prune -f
docker network prune -f

docker logs sql-server

Additional Connection Parameters:
Encrypt=False;TrustServerCertificate=True;

Wait for Startup: SQL Server ko start hone mein 15-20 seconds lagte hain. Uske baad SSMS (Management Studio) mein connect karte waqt Options > Connection Properties > Trust server certificate ko lazmi check karein.

cd /c/Users/Shirjeel-Abid/source/repos
docker-compose down -v --remove-orphans
docker exec -it sql-server bash
docker exec -it sql-server /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Dev@12345!" -C -N -Q "ALTER LOGIN sa ENABLE; ALTER LOGIN sa WITH PASSWORD='Dev@12345!';"
docker exec -it sql-server /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Dev@12345!" -C -N -Q "SELECT 1;"
[docker logs -f sql-server] -- this command is used to check how much time will it take to connect for sql server
docker logs repos-hr-api-1

======================================================
How to copy database from our local db to docker sql?
======================================================
In your own SSMS local instance (ALI-ASAD):
-------------------------------------------
BACKUP DATABASE LearningCoreAuthDb
TO DISK = 'C:\temp\LearningCoreAuthDb.bak'
WITH INIT;

copy the .bak file into the container
--------------------------------------
docker cp C:\temp\LearningCoreAuthDb.bak sql-server:/var/opt/mssql/backup/LearningCoreAuthDb.bak

in case you dont have /backup folder does not exists in your container, use this underlying line
--------------------------------------
docker exec -it sql-server mkdir -p /var/opt/mssql/backup

restore in docker sql
---------------------
docker exec -it sql-server /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Dev@12345!" -C -Q "RESTORE DATABASE LearningCoreAuthDb FROM DISK = '/var/opt/mssql/backup/LearningCoreAuthDb.bak' WITH MOVE 'LearningCoreAuthDb' TO '/var/opt/mssql/data/LearningCoreAuthDb.mdf', MOVE 'LearningCoreAuthDb_log' TO '/var/opt/mssql/data/LearningCoreAuthDb_log.ldf', REPLACE;"

fresh restart the api 
---------------------
docker-compose restart hr-api
and then test this curl http://localhost:8080/health

docker-compose down
docker-compose up --build -d
------------------------------------------- Section ends here for connection setup

docker-compose down -v --remove-orphans  # Volumes aur containers hatao
docker system prune --volumes -f         # Sab unused volumes force delete karo
docker-compose up -d                     # Fresh shuru karo
docker-compose pull
==================================================================================
Official Ubuntu based container images for Microsoft SQL Server for Docker Engine.
==================================================================================
the docker image for sql server is not listed on docker hub, instead it is available in 
microsoft artifact registry i.e. https://mcr.microsoft.com/
we will find Databases on the left side checkboxes list and check it
after that we will click on (Microsoft SQL Server - Ubuntu based images)
in the about section we will see the required images i.e.

2025-latest : docker pull mcr.microsoft.com/mssql/server:2025-latest
2022-latest : docker pull mcr.microsoft.com/mssql/server:2022-latest
2019-latest : docker pull mcr.microsoft.com/mssql/server:2019-latest
2017-latest : docker pull mcr.microsoft.com/mssql/server:2017-latest

we can select as per our requirement. lets say we select this 
docker pull mcr.microsoft.com/mssql/server:2019-latest
and run in window+R command prompt section, this will download the required files.
run underlying commands after downloading to check, or otherwise you can again run the .yml files 
in which you have the sql server section

docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=SqlPassword123" -p 1433:1433  --name sqlserver --hostname sqlserver -d mcr.microsoft.com/mssql/server:2019-latest

docker ps -a
docker stop sqlserver

| Command                     | Image                     | Container                             |
| --------------------------- | ------------------------- | ------------------------------------- |
| `docker-compose up`         | Same image reuse hoti hai | Existing ya new (situation pe depend) |
| `docker-compose up --build` | New image banti hai       | New container                         |
| `docker-compose down && up` | Image same                | New container                         |

Example : pipeline steps (conceptually):
========================================
dotnet build
npm run build
docker build -t hr-api .
docker build -t hr-ui .
docker push hr-api
docker push hr-ui


apt-get update
apt-get install -y curl telnet

Jab ye finish ho jaye, container ke andar hi ye command chalao:
apt-get install -y curl telnet

curl http://localhost:8080

Aur SQL connectivity check karne ke liye:
telnet sql-server 1433

Agar:

telnet sql-server 1433 pe blank screen / connected aa jaye
→ matlab API container SQL container ko network pe reach kar paa raha hai (Docker networking OK)

Agar “connection refused” / “could not resolve host” aaye
→ matlab issue connection string ya docker-compose service name me hai.