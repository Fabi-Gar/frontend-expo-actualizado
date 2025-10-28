# Usa imagen base con Node y Debian estable
FROM node:20-bullseye

# Dependencias del sistema
RUN apt-get update && \
    apt-get install -y openjdk-17-jdk wget unzip git && \
    rm -rf /var/lib/apt/lists/*

# JAVA / Android SDK env
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV ANDROID_HOME=/usr/lib/android-sdk
ENV ANDROID_SDK_ROOT=/usr/lib/android-sdk
ENV PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH

# Command-line tools + licencias + build-tools
RUN mkdir -p $ANDROID_HOME/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/cmdline-tools.zip && \
    unzip -q /tmp/cmdline-tools.zip -d $ANDROID_HOME/cmdline-tools && \
    mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest && \
    rm /tmp/cmdline-tools.zip && \
    yes | sdkmanager --sdk_root=$ANDROID_HOME --licenses && \
    sdkmanager --sdk_root=$ANDROID_HOME "platforms;android-35" "platform-tools" \
      "build-tools;35.0.0" "build-tools;34.0.0" "build-tools;33.0.2"

# Carpeta de app
WORKDIR /app

# Dependencias JS
COPY package*.json ./
RUN npm install -g eas-cli && npm ci

# Copiar proyecto (incluye .eas/ y tu .jks si no montas volumen)
COPY . .

# (Opcional) evitar chequeos de VCS en local
ENV EAS_NO_VCS=1

# Build por defecto: preview APK local
CMD ["eas", "build", "--platform", "android", "--profile", "preview", "--local", "--clear-cache"]
