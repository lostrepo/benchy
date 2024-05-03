FROM debian:bookworm-slim
RUN apt-get update -y --fix-missing
RUN apt-get install -y curl make g++ autoconf libtool unzip xz-utils

WORKDIR /bench

ARG NODE_VERSION=21.7.3
ARG HYPERFINE_VERSION=1.18.0
ARG WRK_VERSION=4.2.0
ARG LO_VERSION=0.0.15-pre

# wrk
RUN curl -L -o wrk.tar.gz https://github.com/wg/wrk/archive/refs/tags/${WRK_VERSION}.tar.gz
RUN tar -zxvf wrk.tar.gz
RUN make -j8 -C wrk-${WRK_VERSION}/
RUN mkdir -p /root/.wrk/bin && cp wrk-${WRK_VERSION}/wrk /root/.wrk/bin/
RUN rm -fr wrk-${WRK_VERSION}/
RUN rm wrk.tar.gz

# hyperfine
RUN curl -L -o hyperfine_${HYPERFINE_VERSION}_amd64.deb https://github.com/sharkdp/hyperfine/releases/download/v${HYPERFINE_VERSION}/hyperfine_${HYPERFINE_VERSION}_amd64.deb
RUN dpkg -i hyperfine_${HYPERFINE_VERSION}_amd64.deb
RUN rm hyperfine_${HYPERFINE_VERSION}_amd64.deb

# node.js
RUN curl -L -o nodejs.tar.xz https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz
RUN tar -xvf nodejs.tar.xz
RUN mv node-v${NODE_VERSION}-linux-x64 /root/.node
ENV NODE_ENV=production
RUN rm nodejs.tar.xz

# lo
RUN curl -L -o lo-linux-x64.gz https://github.com/just-js/lo/releases/download/${LO_VERSION}/lo-linux-x64.gz
RUN gunzip lo-linux-x64.gz
RUN chmod +x lo-linux-x64
RUN ./lo-linux-x64 install
RUN rm lo-linux-x64

# bun
RUN /bin/bash -o pipefail -c "$(curl -fsSL https://bun.sh/install)"

# deno
RUN /bin/bash -o pipefail -c "$(curl -fsSL https://deno.land/install.sh)"

# fix permissions for root
RUN chown -R root:root /root/.deno/
RUN chown -R root:root /root/.node/
RUN chown -R root:root /root/.wrk/
RUN chown -R root:root /root/.bun/

# needed by flamegraph
RUN apt install -y strace linux-perf

# install rust/cargo
RUN curl -L -o rustup.sh --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs && chmod +x rustup.sh
RUN ./rustup.sh -y

# add paths to installed apps
ENV PATH="/root/.node/bin:/root/.bun/bin:/root/.lo/bin:/root/.deno/bin:/root/.wrk/bin:/root/.cargo/bin:$PATH" 

# install flamegraph tool and upgrade bun/deno runtimes
RUN cargo install flamegraph
RUN rm rustup.sh

# update npm
ARG NPM_VERSION=10.5.2
RUN npm install -g npm@${NPM_VERSION}

# bun profile/debug version
RUN curl -L -o bun-linux-x64-profile.zip https://github.com/oven-sh/bun/releases/download/bun-v$(bun --version)/bun-linux-x64-profile.zip
RUN unzip bun-linux-x64-profile.zip
RUN cp -f bun-linux-x64-profile/bun-profile /root/.bun/bin/

# kernel headers for flamegraph/perf
RUN apt install -y linux-headers-generic

CMD ["/bin/bash"]
