# Stage 1: Build (Angular code ko compile karne ke liye)
FROM node:22-alpine AS build
WORKDIR /app

# Pehle sirf package files copy karen taake caching ka faida ho
COPY package*.json ./
RUN npm install

# Baaki saara code copy karein aur build generate karein
COPY . .
RUN npm run build --configuration=production

# Stage 2: Serve (Sirf compiled files ko Nginx par chalane ke liye)
# Stage 2: Serve
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/hr-ui/browser /usr/share/nginx/html

# Port 80 ko expose karen
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
