Install directions
==================

1. `git clone ssh://git@github.com/oada/oada-srvc-docker`
2. `cd oada-srvc-docker`
3. `docker-compose build`
4. `docker-compose run yarn`
5. `docker-compose up -d`

    a. For development, you may need to add the environment variable `NODE_TLS_REJECT_UNAUTHORIZED=0` to ignore self-signed certificates. WARNING: this is insecure)

Windows Installation
====================
1. In windows, go to the "Add, edit, or remove other people" settings to create a local user.

    a. In the lower section under "Other people", click "Add someone else to this PC"
    b. Click "I don't have this person's sign-in information"
    c. At the bottom, click "Add a user without a microsoft account"
    d. Finally, create a username and password for the local account.

2. Install docker for windows https://docs.docker.com/v17.09/docker-for-windows/install/

    a. Specifically, look for and install stable version 17.12 https://download.docker.com/win/stable/15139/Docker%20for%20Windows%20Installer.exe
    b. After installing, search and run "Docker for Windows"
    c. In the lower right of the task bar, click the Docker icon and choose "Settings"
    d. Click the "Shared Drives" tab then click "Reset credentials..." at the bottom
    e. Click the checkbox of the drive you would like to work with from the list and click "Apply".
    f. Authenticate using the local account credentials created in step 1.

3. Install git bash for windows https://gitforwindows.org/

    a. Open Git Bash by right clicking it and choosing "Run as administrator"
    b. Navigate to your desired workspace (e.g., `cd c:`) and enter the command `git clone https://github.com/OADA/oada-srvc-docker`
    c. `cd oada-srvc-docker`
    d. `docker-compose run build` (this gets and installs all of the docker container images--it this takes a bit)

4. Open file explorer, navigate to the "oada-srvc-docker" folder, right click it, and choose "Properties"

    a. At the bottom, uncheck "Read-only (Only applies to files in folder)". Click "Apply".
    b. If prompted, choose to apply to all subfolders and files.
    c. When back to the Properties window, DO NOT CLICK "OK". Leave the window open. Closing it will, for some reason, revert back to Read-only.

5. Back in the git bash terminal, run the command `docker-compose run yarn` (does some additional package installations within the installed containers)

    a. Run `export COMPOSE_CONVERT_WINDOWS_PATHS=1`
    b. Run `docker-compose up -d`
    c. For development, you may need to disable TLS. Before 5b, run `export NODE_TLS_REJECT_UNAUTHORIZED=0`. WARNING: this is insecure

Debugging
=========
Set your local DEBUG variable to "*" or some other wildcard and
that will be passed to any services that are restarted.

Multi-domain:
=============
Everything can start up as localhost by default.  If you want to serve multiple
domains, create the appropriate folder (same name as hostname) in /domains.
The proxy will see it and create domain configs for each name there, and the
auth service will use that info to serve the proper logo, name, etc. for each
service.
