# Usa imagen base con Node y Debian estable
FROM node:20-bullseye

# Instalar dependencias del sistema
RUN apt-get update && \
    apt-get install -y openjdk-17-jdk wget unzip && \
    rm -rf /var/lib/apt/lists/*

# Configurar directorios del SDK de Android
ENV ANDROID_HOME=/usr/lib/android-sdk
ENV PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH

# Instalar command-line tools del SDK
RUN mkdir -p $ANDROID_HOME/cmdline-tools && \
    wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip && \
    unzip cmdline-tools.zip -d $ANDROID_HOME/cmdline-tools && \
    mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest && \
    rm cmdline-tools.zip && \
    yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses && \
    sdkmanager --sdk_root=$ANDROID_HOME "platforms;android-35" "build-tools;35.0.0" "platform-tools"

# Crear carpeta de la app
WORKDIR /app

# Copiar dependencias y código
COPY package*.json ./
RUN npm install -g eas-cli && npm install

COPY . .

# Comando por defecto: build del APK
CMD ["eas", "build", "--platform", "android", "--profile", "preview", "--local"]