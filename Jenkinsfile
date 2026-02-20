pipeline {
  agent none

  options {
    skipDefaultCheckout(true)
  }

  stages {
    stage('Checkout') {
      agent{ label 'app-server' }
      steps {
        checkout scm
      }
    }
    
    stage('Build') {
      agent{ label 'app-server'}
      steps{
        sh '''
           npm install
           npm run dev
        '''
      }
    }



  }
}
