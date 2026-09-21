pipeline {
    agent any

    parameters {
        choice(
            name: 'DEPLOYMENT_ACTION',
            choices: ['DEPLOY', 'ROLLBACK'],
            description: 'Select deployment action'
        )

        choice(
            name: 'ENVIRONMENT',
            choices: ['UAT', 'PRODUCTION'],
            description: 'Select environment'
        )

        string(
            name: 'VERSION',
            defaultValue: '4.2.1',
            description: 'Version to deploy, example: 4.2.1'
        )

        choice(
            name: 'CONFIRM_PROD',
            choices: ['YES', 'NO'],
            description: 'Required YES for production deployment'
        )
    }

    stages {

        stage('Show Parameters') {
            steps {
                echo "======================================"
                echo "Retail Platform Deployment"
                echo "======================================"
                echo "Action       : ${params.DEPLOYMENT_ACTION}"
                echo "Environment  : ${params.ENVIRONMENT}"
                echo "Version      : ${params.VERSION}"
                echo "Confirm Prod : ${params.CONFIRM_PROD}"
            }
        }

        stage('Production Guard') {
            steps {
                script {
                    if (params.ENVIRONMENT == 'PRODUCTION' &&
                        params.CONFIRM_PROD != 'YES') {

                        error("Production deployment blocked: CONFIRM_PROD must be YES")
                    }

                    echo "Production guard passed."
                }
            }
        }

        stage('Validate Git Version') {
            steps {
                bat """
                    git config --global --add safe.directory "C:/ProgramData/Jenkins/.jenkins/workspace/retail-platform"

                    echo Checking Git tag v${params.VERSION}

                    git rev-parse refs/tags/v${params.VERSION}
                """
            }
        }

        stage('Identify Selected Commit') {
            steps {
                bat """
                    git config --global --add safe.directory "C:/ProgramData/Jenkins/.jenkins/workspace/retail-platform"

                    echo Selected version: ${params.VERSION}

                    echo Selected Git commit:

                    git rev-parse refs/tags/v${params.VERSION}
                """
            }
        }

        stage('Build Docker Image') {
            when {
                expression {
                    params.DEPLOYMENT_ACTION == 'DEPLOY'
                }
            }

            steps {
                bat """
                    echo Building Docker image retail-app:${params.VERSION}

                    docker build -t retail-app:${params.VERSION} .
                """
            }
        }
    }
}