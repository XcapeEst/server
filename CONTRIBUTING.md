# How to contribute

I am really glad you are reading this, because we need volunteer developers to help this project come to fruition.

If you haven't already, add [mały](https://discord.com/users/130809187465691136) on Discord and join the [tf2pickup.pl project server](https://discord.gg/YhKJDtuY).


## Coding conventions

Install "ESLint" and "Prettier" VSCode extensions and try to get rid of all of the warnings.

## Testing

* Start the required services

    ```bash
    $ docker-compose up -d
    ```
* Finally, run the server in development mode

    ```bash
    $ yarn dev
    ```

  By default, the server is listening on port 3000 .

* When finishing testing, close the containers

    ```bash
    $ docker-compose down
    ```

  Closing Docker Desktop manually without closing the containers can cause issues and may require a computer restart.

## Submitting changes

This project uses [conventional commits](https://www.conventionalcommits.org) to describe changes. Please make sure you describe each pull request using this standard.

Also, when contributing, make sure to [sign your commits](https://docs.github.com/en/authentication/managing-commit-signature-verification) to increase security!
